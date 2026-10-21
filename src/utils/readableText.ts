// ExcelJS stores hyperlinks, rich text and formula results as objects.
// Never coerce unknown objects with String(): that stores "[object Object]".
export function readableText(value: unknown): string {
  return readText(value).trim()
}

function readText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.includes('[object Object]') ? '' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'object') return ''
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part: unknown) => readText(part)).join('')
  }
  if ('text' in value) return readText(value.text)
  if ('result' in value) return readText(value.result)
  return ''
}

export function requireReadableText(value: unknown, label: string, required = true) {
  const text = readableText(value)
  const invalidValue =
    typeof value === 'string' ? value.includes('[object Object]') : Boolean(value)
  if (!text && (required || invalidValue)) {
    throw new Error(`${label} tidak valid. Isi teks yang benar atau impor ulang dari sumber asli.`)
  }
  return text
}
