import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl'
import type { EarthquakeEvent } from '../types/territorial'
import { buildEarthquakeDepth3DGeometry, type EarthquakeDepth3DVertex } from './earthquakeDepth3D'

const PROJECTION_UNIFORMS = [
  'u_projection_matrix',
  'u_projection_tile_mercator_coords',
  'u_projection_clipping_plane',
  'u_projection_transition',
  'u_projection_fallback_matrix',
] as const

const FLOATS_PER_VERTEX = 7
const STRIDE = FLOATS_PER_VERTEX * 4

function vertexSource(input: CustomRenderMethodInput): string {
  return `#version 300 es
${input.shaderData.vertexShaderPrelude}
${input.shaderData.define}
in vec2 a_pos;
in float a_elevation;
in vec3 a_color;
in float a_size;
uniform float u_pixel_ratio;
out vec3 v_color;

void main() {
  gl_Position = projectTileFor3D(a_pos, a_elevation);
  gl_PointSize = a_size * u_pixel_ratio;
  v_color = a_color;
}`
}

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_color;
uniform float u_opacity;
uniform bool u_points;
out vec4 fragColor;

void main() {
  if (u_points) {
    vec2 d = gl_PointCoord - vec2(0.5);
    if (dot(d, d) > 0.25) discard;
  }
  fragColor = vec4(v_color * u_opacity, u_opacity);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('No se pudo crear el shader de profundidad sísmica.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'error desconocido'
    gl.deleteShader(shader)
    throw new Error(`No se pudo compilar el shader de profundidad sísmica: ${info}`)
  }
  return shader
}

function writeVertex(data: Float32Array, vertexIndex: number, vertex: EarthquakeDepth3DVertex) {
  const offset = vertexIndex * FLOATS_PER_VERTEX
  data[offset] = vertex.x
  data[offset + 1] = vertex.y
  data[offset + 2] = vertex.elevation
  data[offset + 3] = vertex.color[0] / 255
  data[offset + 4] = vertex.color[1] / 255
  data[offset + 5] = vertex.color[2] / 255
  data[offset + 6] = vertex.size
}

export class EarthquakeDepth3DLayer implements CustomLayerInterface {
  readonly id = 'earthquake-depth-3d'
  readonly type = 'custom' as const
  readonly renderingMode = '3d' as const

  private map: MapLibreMap | null = null
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private vao: WebGLVertexArrayObject | null = null
  private variant = ''
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private data = new Float32Array(0)
  private lineVertexCount = 0
  private pointVertexCount = 0
  private dirty = true
  private visible = false

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map
    this.buffer = gl.createBuffer()
    this.vao = gl.createVertexArray()
    this.program = null
    this.variant = ''
    this.uniforms = {}
    this.dirty = true
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext): void {
    if (this.program) gl.deleteProgram(this.program)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    if (this.vao) gl.deleteVertexArray(this.vao)
    this.map = null
    this.program = null
    this.buffer = null
    this.vao = null
    this.variant = ''
    this.uniforms = {}
  }

  setEvents(events: EarthquakeEvent[]): void {
    const { stems, points } = buildEarthquakeDepth3DGeometry(events)
    const vertices = [...stems, ...points]
    const data = new Float32Array(vertices.length * FLOATS_PER_VERTEX)
    vertices.forEach((vertex, index) => writeVertex(data, index, vertex))
    this.data = data
    this.lineVertexCount = stems.length
    this.pointVertexCount = points.length
    this.dirty = true
    this.map?.triggerRepaint()
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return
    this.visible = visible
    this.map?.triggerRepaint()
  }

  private ensureProgram(gl: WebGL2RenderingContext, input: CustomRenderMethodInput): WebGLProgram {
    if (this.program && this.variant === input.shaderData.variantName) return this.program
    if (this.program) gl.deleteProgram(this.program)

    const vertexShader = compile(gl, gl.VERTEX_SHADER, vertexSource(input))
    const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE)
    const program = gl.createProgram()
    if (!program) throw new Error('No se pudo crear el programa 3D de profundidad sísmica.')
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? 'error desconocido'
      gl.deleteProgram(program)
      throw new Error(`No se pudo enlazar el programa 3D de profundidad sísmica: ${info}`)
    }

    this.program = program
    this.variant = input.shaderData.variantName
    this.uniforms = {}
    for (const name of [...PROJECTION_UNIFORMS, 'u_pixel_ratio', 'u_opacity', 'u_points']) {
      this.uniforms[name] = gl.getUniformLocation(program, name)
    }

    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const position = gl.getAttribLocation(program, 'a_pos')
    const elevation = gl.getAttribLocation(program, 'a_elevation')
    const color = gl.getAttribLocation(program, 'a_color')
    const size = gl.getAttribLocation(program, 'a_size')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, STRIDE, 0)
    gl.enableVertexAttribArray(elevation)
    gl.vertexAttribPointer(elevation, 1, gl.FLOAT, false, STRIDE, 8)
    gl.enableVertexAttribArray(color)
    gl.vertexAttribPointer(color, 3, gl.FLOAT, false, STRIDE, 12)
    gl.enableVertexAttribArray(size)
    gl.vertexAttribPointer(size, 1, gl.FLOAT, false, STRIDE, 24)
    gl.bindVertexArray(null)

    return program
  }

  private setProjectionUniforms(gl: WebGL2RenderingContext, input: CustomRenderMethodInput): void {
    const projection = input.defaultProjectionData
    for (const name of PROJECTION_UNIFORMS) {
      const location = this.uniforms[name]
      if (!location) continue
      if (name === 'u_projection_matrix') gl.uniformMatrix4fv(location, false, projection.mainMatrix)
      else if (name === 'u_projection_fallback_matrix') gl.uniformMatrix4fv(location, false, projection.fallbackMatrix)
      else if (name === 'u_projection_tile_mercator_coords') gl.uniform4fv(location, projection.tileMercatorCoords)
      else if (name === 'u_projection_clipping_plane') gl.uniform4fv(location, projection.clippingPlane)
      else if (name === 'u_projection_transition') gl.uniform1f(location, projection.projectionTransition)
    }
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput): void {
    if (!this.visible || this.pointVertexCount === 0) return

    const program = this.ensureProgram(gl, input)
    gl.useProgram(program)

    if (this.dirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STATIC_DRAW)
      this.dirty = false
    }

    this.setProjectionUniforms(gl, input)
    const canvas = this.map?.getCanvas()
    const pixelRatio = canvas ? canvas.width / (canvas.clientWidth || 1) : 1
    gl.uniform1f(this.uniforms.u_pixel_ratio, pixelRatio)

    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.bindVertexArray(this.vao)

    gl.uniform1i(this.uniforms.u_points, 0)
    gl.uniform1f(this.uniforms.u_opacity, 0.28)
    gl.drawArrays(gl.LINES, 0, this.lineVertexCount)

    gl.uniform1i(this.uniforms.u_points, 1)
    gl.uniform1f(this.uniforms.u_opacity, 0.96)
    gl.drawArrays(gl.POINTS, this.lineVertexCount, this.pointVertexCount)

    gl.bindVertexArray(null)
    gl.depthMask(true)
  }
}
