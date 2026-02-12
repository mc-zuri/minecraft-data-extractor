/**
 * Analyzes Java2Bedrock.json to find blocks where multiple Java states
 * map to the same Bedrock state (collapsed states that may need dynamic collision)
 */

const fs = require('fs')
const path = require('path')

const outputPath = process.argv[2] || './output/1.21.130'
const Java2Bedrock = JSON.parse(fs.readFileSync(path.join(outputPath, 'blocks/Java2Bedrock.json'), 'utf-8'))

// Parse state string like "minecraft:oak_fence[east=true,north=false,...]"
function parseState(stateStr) {
  const match = stateStr.match(/^([^[]+)\[([^\]]*)\]$/)
  if (!match) return { name: stateStr, states: {} }

  const name = match[1]
  const states = {}
  if (match[2]) {
    match[2].split(',').forEach(pair => {
      const [key, value] = pair.split('=')
      states[key] = value
    })
  }
  return { name, states }
}

// Group Java states by their Bedrock target
const bedrockToJava = {}

for (const [javaState, bedrockState] of Object.entries(Java2Bedrock)) {
  if (!bedrockToJava[bedrockState]) {
    bedrockToJava[bedrockState] = []
  }
  bedrockToJava[bedrockState].push(javaState)
}

// Find blocks where multiple Java states collapse to one Bedrock state
const collapsedBlocks = {}

for (const [bedrockState, javaStates] of Object.entries(bedrockToJava)) {
  if (javaStates.length > 1) {
    const parsed = parseState(bedrockState)
    const blockName = parsed.name.replace('minecraft:', '')

    if (!collapsedBlocks[blockName]) {
      collapsedBlocks[blockName] = {
        bedrockStates: {},
        collapsedProperties: new Set(),
        maxCollapse: 0
      }
    }

    collapsedBlocks[blockName].bedrockStates[bedrockState] = javaStates.length
    collapsedBlocks[blockName].maxCollapse = Math.max(
      collapsedBlocks[blockName].maxCollapse,
      javaStates.length
    )

    // Find which Java properties are being collapsed
    const javaProps = new Set()
    javaStates.forEach(js => {
      const p = parseState(js)
      Object.keys(p.states).forEach(k => javaProps.add(k))
    })

    const bedrockProps = new Set(Object.keys(parsed.states))
    javaProps.forEach(prop => {
      if (!bedrockProps.has(prop)) {
        collapsedBlocks[blockName].collapsedProperties.add(prop)
      }
    })
  }
}

// Convert Sets to arrays for JSON output
const result = {}
for (const [name, data] of Object.entries(collapsedBlocks)) {
  result[name] = {
    maxCollapse: data.maxCollapse,
    collapsedProperties: Array.from(data.collapsedProperties).sort(),
    bedrockStateCount: Object.keys(data.bedrockStates).length
  }
}

// Sort by maxCollapse descending
const sorted = Object.entries(result)
  .sort((a, b) => b[1].maxCollapse - a[1].maxCollapse)

// Print summary
console.log('='.repeat(80))
console.log('BLOCKS WITH COLLAPSED JAVA STATES (sorted by collapse ratio)')
console.log('='.repeat(80))
console.log('')

// Group by collapsed properties
const byCollapsedProps = {}

for (const [name, data] of sorted) {
  const propsKey = data.collapsedProperties.join(',') || '(none)'
  if (!byCollapsedProps[propsKey]) {
    byCollapsedProps[propsKey] = []
  }
  byCollapsedProps[propsKey].push({ name, ...data })
}

// Print grouped by collapsed properties
for (const [props, blocks] of Object.entries(byCollapsedProps).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n## Collapsed properties: [${props}]`)
  console.log(`   Count: ${blocks.length} block types`)
  console.log('   Blocks:')

  for (const block of blocks.slice(0, 10)) {
    console.log(`     - ${block.name} (${block.maxCollapse}x collapse, ${block.bedrockStateCount} bedrock states)`)
  }
  if (blocks.length > 10) {
    console.log(`     ... and ${blocks.length - 10} more`)
  }
}

// Focus on blocks that might need dynamic collision (high collapse with neighbor properties)
console.log('\n' + '='.repeat(80))
console.log('BLOCKS LIKELY NEEDING DYNAMIC COLLISION (neighbor-dependent properties)')
console.log('='.repeat(80))

const neighborProps = ['east', 'west', 'north', 'south', 'up', 'down', 'shape']
const dynamicCandidates = sorted.filter(([name, data]) =>
  data.collapsedProperties.some(p => neighborProps.includes(p))
)

console.log('\n| Block | Collapse | Collapsed Properties |')
console.log('|-------|----------|---------------------|')

for (const [name, data] of dynamicCandidates) {
  console.log(`| ${name} | ${data.maxCollapse}x | ${data.collapsedProperties.join(', ')} |`)
}

// Save full results to JSON
const outputFile = path.join(outputPath, 'collapsed-states-analysis.json')
fs.writeFileSync(outputFile, JSON.stringify({
  summary: {
    totalCollapsedBlocks: sorted.length,
    dynamicCandidates: dynamicCandidates.length
  },
  byCollapsedProperties: byCollapsedProps,
  allBlocks: Object.fromEntries(sorted)
}, null, 2))

console.log(`\nFull analysis saved to: ${outputFile}`)
