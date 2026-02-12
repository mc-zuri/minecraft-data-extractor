const fs = require('fs')
const path = require('path')

/**
 * Converts Bedrock block states to Java block states
 */
class BedrockToJavaBlockConverter {
  constructor(mappingPath) {
    this.mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'))
  }

  /**
   * Parse a block state string into name and properties
   * @param {string} stateString - e.g. "minecraft:beetroot[growth=0]"
   * @returns {{ name: string, properties: Object }}
   */
  parseBlockState(stateString) {
    const match = stateString.match(/^([^[]+)(?:\[([^\]]*)\])?$/)
    if (!match) return { name: stateString, properties: {} }

    const name = match[1]
    const properties = {}

    if (match[2]) {
      match[2].split(',').forEach(pair => {
        const [key, value] = pair.split('=')
        if (key && value !== undefined) {
          properties[key.trim()] = value.trim()
        }
      })
    }

    return { name, properties }
  }

  /**
   * Convert properties object to sorted state string
   * @param {Object} properties
   * @returns {string}
   */
  propertiesToString(properties) {
    const keys = Object.keys(properties).sort()
    if (keys.length === 0) return ''
    return keys.map(k => `${k}=${properties[k]}`).join(',')
  }

  /**
   * Build a block state string from name and properties
   * @param {string} name
   * @param {Object} properties
   * @returns {string}
   */
  buildBlockState(name, properties) {
    const propsStr = this.propertiesToString(properties)
    return `${name}[${propsStr}]`
  }

  /**
   * Convert Bedrock block state to Java block state
   * @param {string} bedrockState - Full state string like "minecraft:beetroot[growth=0]"
   * @returns {string|null} - Java state string or null if not found
   */
  convert(bedrockState) {
    // Normalize the input
    const { name, properties } = this.parseBlockState(bedrockState)
    const normalizedState = this.buildBlockState(name, properties)

    // Direct lookup
    if (this.mappings[normalizedState]) {
      return this.mappings[normalizedState]
    }

    // Try with empty properties if no match
    const emptyState = `${name}[]`
    if (this.mappings[emptyState]) {
      return this.mappings[emptyState]
    }

    return null
  }

  /**
   * Convert using block name and properties object
   * @param {string} blockName - e.g. "minecraft:beetroot"
   * @param {Object} properties - e.g. { growth: 0 }
   * @returns {string|null}
   */
  convertFromParts(blockName, properties = {}) {
    const bedrockState = this.buildBlockState(blockName, properties)
    return this.convert(bedrockState)
  }

  /**
   * Get Java block info parsed from state string
   * @param {string} bedrockState
   * @returns {{ name: string, properties: Object }|null}
   */
  convertParsed(bedrockState) {
    const javaState = this.convert(bedrockState)
    if (!javaState) return null
    return this.parseBlockState(javaState)
  }
}

// Factory function for easy usage
function createConverter(version = '1.21.130') {
  const mappingPath = path.join(__dirname, '..', 'output', version, 'minecraft-data', 'blocksB2J.json')
  return new BedrockToJavaBlockConverter(mappingPath)
}

module.exports = { BedrockToJavaBlockConverter, createConverter }

// Example usage when run directly
if (require.main === module) {
  const converter = createConverter()

  // Test conversions
  const tests = [
    'minecraft:beetroot[growth=0]',
    'minecraft:beetroot[growth=7]',
    'minecraft:oak_log[pillar_axis=y]',
    'minecraft:stone[]',
    'minecraft:grass_block[]'
  ]

  console.log('Bedrock to Java Block State Converter\n')
  for (const test of tests) {
    const result = converter.convert(test)
    console.log(`${test}`)
    console.log(`  -> ${result}\n`)
  }

  // Test with parts
  console.log('Using convertFromParts:')
  const result = converter.convertFromParts('minecraft:beetroot', { growth: 7 })
  console.log(`minecraft:beetroot + {growth: 7} -> ${result}`)
}
