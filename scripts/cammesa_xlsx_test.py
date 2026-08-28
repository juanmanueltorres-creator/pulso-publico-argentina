import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from cammesa_xlsx import extract_cammesa_summary


WORKBOOK_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Base de Datos" sheetId="1" r:id="rId1"/>
    <sheet name="Tabla Resumen Global" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>
'''

RELS_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>
  <Relationship Id="rId2" Target="worksheets/sheet2.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>
</Relationships>
'''

SHEET_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="4">
      <c r="B4" t="inlineStr"><is><t>FUENTE DE ENERGÍA</t></is></c>
      <c r="C4"><v>2025</v></c>
      <c r="D4"><v>46023</v></c>
      <c r="E4"><v>46054</v></c>
      <c r="F4"><v>46204</v></c>
    </row>
    <row r="11">
      <c r="B11" t="inlineStr"><is><t>Total GWh</t></is></c>
      <c r="C11"><v>26659.368639</v></c>
      <c r="D11"><v>2472.414869</v></c>
      <c r="E11"><v>2256.716335</v></c>
      <c r="F11"><v>1791.245147</v></c>
    </row>
  </sheetData>
</worksheet>
'''

EMPTY_SHEET_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>
'''


def write_fixture(path: Path, summary_sheet: str = SHEET_XML) -> None:
    with ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', WORKBOOK_XML)
        archive.writestr('xl/_rels/workbook.xml.rels', RELS_XML)
        archive.writestr('xl/worksheets/sheet1.xml', EMPTY_SHEET_XML)
        archive.writestr('xl/worksheets/sheet2.xml', summary_sheet)


class CammesaXlsxTest(unittest.TestCase):
    def test_extracts_latest_monthly_total_from_summary_sheet(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = Path(directory) / 'cammesa.xlsx'
            write_fixture(workbook)

            result = extract_cammesa_summary(workbook)

            self.assertEqual(
                result,
                {'period': '2026-07', 'totalGwh': 1791.245147},
            )

    def test_fails_closed_without_total_gwh_row(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = Path(directory) / 'cammesa.xlsx'
            write_fixture(workbook, EMPTY_SHEET_XML)

            with self.assertRaisesRegex(ValueError, 'Total GWh'):
                extract_cammesa_summary(workbook)


if __name__ == '__main__':
    unittest.main()
