#!/usr/bin/env python3
import json
import math
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ET

MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS = {'m': MAIN_NS, 'r': REL_NS, 'pr': PACKAGE_REL_NS}
EXCEL_EPOCH = datetime(1899, 12, 30, tzinfo=timezone.utc)
SUMMARY_SHEET = 'Tabla Resumen Global'


def _column_name(cell_ref: str) -> str:
    match = re.match(r'([A-Z]+)', cell_ref or '')
    if not match:
        raise ValueError(f'Invalid XLSX cell reference: {cell_ref!r}')
    return match.group(1)


def _shared_strings(archive: ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in archive.namelist():
        return []

    root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
    values = []
    for item in root.findall('m:si', NS):
        values.append(''.join(node.text or '' for node in item.iterfind('.//m:t', NS)))
    return values


def _cell_value(cell: ET.Element, shared: list[str]):
    cell_type = cell.attrib.get('t')
    value_node = cell.find('m:v', NS)

    if cell_type == 's' and value_node is not None:
        index = int(value_node.text)
        if index < 0 or index >= len(shared):
            raise ValueError('Shared string index is outside the workbook table')
        return shared[index]

    if cell_type == 'inlineStr':
        inline = cell.find('m:is', NS)
        if inline is None:
            return ''
        return ''.join(node.text or '' for node in inline.iterfind('.//m:t', NS))

    if cell_type == 'str':
        return value_node.text if value_node is not None else ''

    if value_node is None or value_node.text is None:
        return ''

    raw = value_node.text.strip()
    try:
        return float(raw)
    except ValueError:
        return raw


def _sheet_path(archive: ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    targets = {
        relation.attrib['Id']: relation.attrib['Target']
        for relation in relationships.findall('pr:Relationship', NS)
    }

    sheets = workbook.find('m:sheets', NS)
    if sheets is None:
        raise ValueError('CAMMESA workbook does not contain sheets')

    for sheet in sheets:
        if sheet.attrib.get('name') != sheet_name:
            continue

        relation_id = sheet.attrib.get(f'{{{REL_NS}}}id')
        target = targets.get(relation_id)
        if not target:
            raise ValueError(f'Worksheet relationship missing for {sheet_name}')

        target = target.replace('\\', '/')
        if target.startswith('/'):
            return target.lstrip('/')
        if target.startswith('xl/'):
            return target
        return f"xl/{target.lstrip('/')}"

    raise ValueError(f'CAMMESA workbook is missing sheet {sheet_name}')


def _rows_by_number(sheet_root: ET.Element, shared: list[str]) -> dict[int, dict[str, object]]:
    rows = {}
    for row in sheet_root.findall('.//m:sheetData/m:row', NS):
        row_number = int(row.attrib.get('r', '0'))
        values = {}
        for cell in row.findall('m:c', NS):
            ref = cell.attrib.get('r', '')
            values[_column_name(ref)] = _cell_value(cell, shared)
        rows[row_number] = values
    return rows


def _find_row(rows: dict[int, dict[str, object]], label: str) -> dict[str, object]:
    normalized = label.strip().casefold()
    for values in rows.values():
        if any(isinstance(value, str) and value.strip().casefold() == normalized for value in values.values()):
            return values
    raise ValueError(f'CAMMESA workbook does not contain {label} row')


def _latest_month_column(header_row: dict[str, object]) -> tuple[str, datetime]:
    candidates = []
    for column, value in header_row.items():
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            continue
        if not math.isfinite(float(value)) or float(value) < 40000:
            continue

        date = EXCEL_EPOCH + timedelta(days=float(value))
        candidates.append((date, column))

    if not candidates:
        raise ValueError('CAMMESA workbook does not contain monthly date columns')

    date, column = max(candidates, key=lambda item: item[0])
    return column, date


def extract_cammesa_summary(path: Path | str) -> dict[str, object]:
    workbook_path = Path(path)
    if not workbook_path.is_file():
        raise ValueError(f'CAMMESA workbook not found: {workbook_path}')

    try:
        with ZipFile(workbook_path) as archive:
            shared = _shared_strings(archive)
            sheet_path = _sheet_path(archive, SUMMARY_SHEET)
            sheet_root = ET.fromstring(archive.read(sheet_path))
            rows = _rows_by_number(sheet_root, shared)
    except (BadZipFile, KeyError, ET.ParseError) as error:
        raise ValueError(f'CAMMESA workbook is not a readable XLSX: {error}') from error

    header_row = _find_row(rows, 'FUENTE DE ENERGÍA')
    total_row = _find_row(rows, 'Total GWh')
    latest_column, latest_date = _latest_month_column(header_row)

    raw_total = total_row.get(latest_column)
    if not isinstance(raw_total, (int, float)) or isinstance(raw_total, bool):
        raise ValueError('CAMMESA Total GWh value must be numeric')

    total_gwh = float(raw_total)
    if not math.isfinite(total_gwh):
        raise ValueError('CAMMESA Total GWh value must be finite')

    return {
        'period': latest_date.strftime('%Y-%m'),
        'totalGwh': total_gwh,
    }


def main() -> int:
    if len(sys.argv) != 2:
        print('usage: cammesa_xlsx.py <workbook.xlsx>', file=sys.stderr)
        return 2

    try:
        result = extract_cammesa_summary(sys.argv[1])
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
