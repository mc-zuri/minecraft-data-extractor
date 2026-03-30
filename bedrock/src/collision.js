const fs = require('fs')
const nbt = require('prismarine-nbt')
const stringify = require("json-stringify-pretty-compact")
const assert = require('assert')
const strip = k => k.replace('minecraft:', '').split('[')[0]

/**
 * Custom JSON serializer with configurable inline rules
 * @param {Object} obj - Object to serialize
 * @param {Object} options - Serialization options
 * @param {string} options.indent - Indent string (default: '\t')
 * @param {Object} options.inline - Rules for what should be kept inline
 * @param {boolean} options.inline.blockArrays - Keep block shape arrays inline
 * @param {boolean} options.inline.shapeArrays - Keep individual shape coordinate arrays inline
 * @param {boolean} options.inline.dynamicShapes - Keep dynamicShapes object inline
 * @param {number} options.inline.maxLength - Max length for inline arrays
 */
function customJSONStringify(obj, options = {}) {
  const indent = options.indent || '\t'
  const inline = options.inline || {}

  function stringifyValue(value, depth, key, parentKey) {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'

    const type = typeof value
    if (type === 'string') return JSON.stringify(value)
    if (type === 'number' || type === 'boolean') return String(value)

    if (Array.isArray(value)) {
      // Check if this should be inline based on context
      const str = JSON.stringify(value).replace(/,/g, ', ')  // Add space after commas

      // Block arrays (under "blocks" or "visualBlocks" key) - always inline if enabled
      if (inline.blockArrays && (parentKey === 'blocks' || parentKey === 'visualBlocks')) {
        return str
      }

      // Shape coordinate arrays (nested arrays under "shapes") - inline if enabled
      if (inline.shapeArrays && parentKey === 'shapes' && str.length < (inline.maxLength || 10000)) {
        return str
      }

      // Default array formatting
      if (str.length < 100) return str

      const items = value.map((v, i) => stringifyValue(v, depth + 1, i, key))
      return '[\n' + indent.repeat(depth + 1) + items.join(',\n' + indent.repeat(depth + 1)) + '\n' + indent.repeat(depth) + ']'
    }

    if (type === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) return '{}'

      // DynamicShapes - format with each type on separate line, but arrays inline
      if (inline.dynamicShapes && key === 'dynamicShapes') {
        const entries = keys.map(k => {
          const arrayStr = JSON.stringify(value[k]).replace(/,/g, ', ')  // Add space after commas
          return indent.repeat(depth + 1) + JSON.stringify(k) + ': ' + arrayStr
        })
        return '{\n' + entries.join(',\n') + '\n' + indent.repeat(depth) + '}'
      }

      // Small objects (like shapeType) - keep inline
      const objStr = JSON.stringify(value).replace(/:/g, ': ').replace(/,/g, ', ')
      if (objStr.length < 100) {
        return objStr
      }

      // Regular object formatting
      const entries = keys.map(k => {
        const v = stringifyValue(value[k], depth + 1, k, key)
        return indent.repeat(depth + 1) + JSON.stringify(k) + ': ' + v
      })

      return '{\n' + entries.join(',\n') + '\n' + indent.repeat(depth) + '}'
    }

    return String(value)
  }

  return stringifyValue(obj, 0, null, null)
}
const sequential = data => {
  data = data.map(k => parseInt(k))
  if (data.length < 2) return true
  for (let i = data[0], j = 0; i <= data[data.length - 1]; i++, j++) {
    // console.log(data[j], data[0] + j)
    if (data[j] != (data[0] + j)) return false
    // if (data[data[0] + j] != (data[0] + j)) return false
  }
  return true
}

async function createCollisionDataV1(version, outputPath) {
  const geyserMappings = require('./deps/mappings-generator/mappings/blocks.json')
  const collisions = require('./deps/mappings-generator/mappings/collision.json')
  const bedrockBlockStates = require(`./${outputPath}/blocks/BlockStates.json`)

  const buildBSS = states => {
    let s = []
    for (const k in states) {
      const v = states[k]
      s.push(`${k}=${v}`)
    }
    return s.join(',')
  }

  function getStateIDFor(name, states) {
    // if (!states) return ""
    for (const i in bedrockBlockStates) {
      const block = bedrockBlockStates[i]
      // console.log(block.name, name, states)
      if (block.name === name.replace('minecraft:', '')) {
        let failed
        if (!states) return i
        for (const [state, value] of Object.entries(states)) {
          // console.log(block.states.value, state, value)
          if (block.states[state]?.value != value) { failed = true; break }
        }
        if (!failed) return i
      }
    }
  }

  const out = {}
  const col = {}
  // console.log(collisions)
  // return


  /**
   * The following code builds a map of blockIdName => Array of block state indexes
   */
  for (const javaId in geyserMappings) {
    const maping = geyserMappings[javaId]
    const ss = buildBSS(maping.bedrock_states)
    // This is a mapping that contains bedrock block names as their keys, and 
    // their indexes to the collisions map as their values. We need to make sure
    // We need to make sure 
    const o = (out[`${strip(maping.bedrock_identifier)}`] ??= {})
    // console.log(maping)

    // Put a second map into `o` that maps state IDs for each of the bedrock block names
    // to a collision index.
    const stateID = getStateIDFor(maping.bedrock_identifier, maping.bedrock_states)
    // console.log('stateID', stateID, maping)
    assert(stateID, `Could not find stateID for ${maping.bedrock_identifier}`)
    o[stateID] = maping.collision_index

    // Make sure that the `o` map's keys of BRIDs are sequential and don't have any gaps.
    // That's because we do minStateId + stateNumber to figure out which collision to use. 
    const keys = Object.keys(o)
    // console.log('keys', keys)
    // Get the "default" collision index for this block in case a missing block state doesn't have one.
    // The default is just the first one we find.
    const defVal = o[keys[0]]
    // console.log('defVal', defVal)

    if (!sequential(keys)) {
      // console.warn(`⚠ GAP in collisions for ${maping.bedrock_identifier} / ${javaId}, ${keys} -- filling in`)
      let lastVal
      for (let i = parseInt(keys[0]); i <= parseInt(keys[keys.length - 1]); i++) {
        o[i] ??= defVal
        // console.log('I', i, o[i])
      }
      // console.log('Now: ' + JSON.stringify(Object.entries(o)), defVal)
      if (!sequential(Object.keys(o))) throw Error()
    }
    // assert(sequential(keys), `GAP! ${javaId}, ${keys}`)

    col[maping.collision_index] = collisions[maping.collision_index]
  }

  for (const key in out) {
    const minStateId = getStateIDFor('minecraft:'+key)
    const val = out[key]
    const keys = Object.keys(val).map(k => parseInt(k))
    const next = []
    for (let i = minStateId; i <= keys[keys.length - 1]; i++) {
      if (val[i] != null) next.push(val[i])
      else next.push(0)
    }
    out[key] = next
    console.log('Next', next, minStateId, keys[keys.length - 1])
    if (next.length < keys.length) throw Error()
  }
  
  fs.writeFileSync(outputPath + '/blockCollisionShapes.json', stringify({ blocks: out, shapes: col }, { indent: '\t', maxLength: 19999 }))
  console.log('V1: Generated collision data')
}

async function createCollisionDataV2(version, outputPath){
  const BSS = require(outputPath + '/blocks/BSS.json')
  const blocksJSON = require(outputPath + '/blocks.json')
  const Java2Bedrock = require(outputPath + '/blocks/Java2Bedrock.json')

  const collisionsData =fs.readFileSync(`./src/deps/mappings-generator/mappings/collisions.nbt`);
  const collisionsNbt = await nbt.parse(collisionsData);
  const collisionsJSON = nbt.simplify(collisionsNbt.parsed);

  const collisions = {
    blocks: {}, 
    shapes: {}
  }

  const bedrockBlockStateId_2_collisionIndex = {};
  const bedrock_block_states = Object.values(Java2Bedrock);
  for(const bedrockBlockIndex in bedrock_block_states){
    const bedrockStateName = bedrock_block_states[bedrockBlockIndex];
    const index = BSS[jss2bss(bedrockStateName)]
    if(index == null){
      //throw new Error('not found bedrock block state id')
      console.error('not found bedrock block state id', bedrockStateName)
    }
    bedrockBlockStateId_2_collisionIndex[index]= bedrockBlockIndex;
  }

  for(const bedrockBlockIndex in blocksJSON){
    let bedrockBlock = blocksJSON[bedrockBlockIndex];
     for(let stateId = bedrockBlock.minStateId; stateId <= bedrockBlock.maxStateId; stateId++){
      if(!collisions.blocks[strip(bedrockBlock.name)]){
          collisions.blocks[strip(bedrockBlock.name)] = []
      }

      if(bedrockBlockStateId_2_collisionIndex[stateId] != undefined){
        collisions.blocks[strip(bedrockBlock.name)].push(collisionsJSON.indices[bedrockBlockStateId_2_collisionIndex[stateId]]);
      }else{
        collisions.blocks[strip(bedrockBlock.name)].push(0);
      }       
    }
  }
  
  for (const key in collisionsJSON.collisions) {
    const value = collisionsJSON.collisions[key]  
    collisions.shapes[key] = value;
  }
  
  fs.writeFileSync(outputPath + '/blockCollisionShapes.json', stringify(collisions, { indent: '\t', maxLength: 19999 })) 
  fs.writeFileSync(outputPath + '/minecraft-data/blockCollisionShapes.json', stringify(collisions, { indent: '\t', maxLength: 19999 })) 
}

function jss2bss(val) {
  val = val.replace(/=true/g, '=1')
  val = val.replace(/=false/g, '=0')
  return val
}

// Block types that require dynamic collision shapes based on neighbors
const DYNAMIC_BLOCK_TYPES = {
  fence: [
    'oak_fence', 'spruce_fence', 'birch_fence', 'jungle_fence', 'acacia_fence',
    'cherry_fence', 'dark_oak_fence', 'pale_oak_fence', 'mangrove_fence',
    'bamboo_fence', 'nether_brick_fence', 'crimson_fence', 'warped_fence'
  ],
  pane: [
    'glass_pane', 'iron_bars',
    'white_stained_glass_pane', 'orange_stained_glass_pane', 'magenta_stained_glass_pane',
    'light_blue_stained_glass_pane', 'yellow_stained_glass_pane', 'lime_stained_glass_pane',
    'pink_stained_glass_pane', 'gray_stained_glass_pane', 'light_gray_stained_glass_pane',
    'cyan_stained_glass_pane', 'purple_stained_glass_pane', 'blue_stained_glass_pane',
    'brown_stained_glass_pane', 'green_stained_glass_pane', 'red_stained_glass_pane',
    'black_stained_glass_pane',
    // Copper bars (same collision behavior as iron_bars)
    'copper_bars', 'exposed_copper_bars', 'weathered_copper_bars', 'oxidized_copper_bars',
    'waxed_copper_bars', 'waxed_exposed_copper_bars', 'waxed_weathered_copper_bars',
    'waxed_oxidized_copper_bars'
  ],
  stairs: [
    'oak_stairs', 'spruce_stairs', 'birch_stairs', 'jungle_stairs', 'acacia_stairs',
    'cherry_stairs', 'dark_oak_stairs', 'pale_oak_stairs', 'mangrove_stairs',
    'bamboo_stairs', 'bamboo_mosaic_stairs', 'stone_stairs', 'cobblestone_stairs',
    'mossy_cobblestone_stairs', 'stone_brick_stairs', 'mossy_stone_brick_stairs',
    'brick_stairs', 'sandstone_stairs', 'red_sandstone_stairs', 'nether_brick_stairs',
    'red_nether_brick_stairs', 'quartz_stairs', 'smooth_quartz_stairs', 'purpur_stairs',
    'prismarine_stairs', 'prismarine_bricks_stairs', 'dark_prismarine_stairs',
    'polished_granite_stairs', 'polished_diorite_stairs', 'polished_andesite_stairs',
    'granite_stairs', 'diorite_stairs', 'andesite_stairs', 'end_brick_stairs',
    'normal_stone_stairs', 'smooth_sandstone_stairs', 'smooth_red_sandstone_stairs',
    'mud_brick_stairs', 'resin_brick_stairs', 'blackstone_stairs', 'polished_blackstone_stairs',
    'polished_blackstone_brick_stairs', 'cut_copper_stairs', 'exposed_cut_copper_stairs',
    'weathered_cut_copper_stairs', 'oxidized_cut_copper_stairs', 'waxed_cut_copper_stairs',
    'waxed_exposed_cut_copper_stairs', 'waxed_weathered_cut_copper_stairs',
    'waxed_oxidized_cut_copper_stairs', 'cobbled_deepslate_stairs', 'polished_deepslate_stairs',
    'deepslate_brick_stairs', 'deepslate_tile_stairs', 'tuff_stairs', 'polished_tuff_stairs',
    'tuff_brick_stairs'
  ],
  chorus: ['chorus_plant']
}

// Get shapeType for a block name
function getShapeType(blockName) {
  for (const [type, blocks] of Object.entries(DYNAMIC_BLOCK_TYPES)) {
    if (blocks.includes(blockName)) return type
  }
  return null
}

/**
 * V3: Creates collision data directly from block_states.json
 * Uses collisionShape field from extracted game data
 * Uses dynamic_collision_shapes.json for dynamic blocks (fences, panes, stairs, chorus)
 */
async function createCollisionDataV3(version, outputPath, dataPath) {
  const blocksJSON = require(outputPath + '/blocks.json')
  const blockStatesJSON = require(dataPath + '/block_states.json')

  // Try to load dynamic collision shapes from plugin output
  let dynamicShapes = null
  const dynamicShapesPaths = [
    outputPath + '/dynamic_collision_shapes.json',
    dataPath + '/dynamic_collision_shapes.json'
  ]
  for (const p of dynamicShapesPaths) {
    if (fs.existsSync(p)) {
      dynamicShapes = JSON.parse(fs.readFileSync(p, 'utf-8'))
      console.log('Loaded dynamic collision shapes from:', p)
      break
    }
  }
  if (!dynamicShapes) {
    console.warn('Warning: dynamic_collision_shapes.json not found. Run /collisiondynamic in Endstone server first.')
  }

  const collisions = {
    blocks: {},
    visualBlocks: {},
    shapes: {},
    dynamicShapes: {}
  }

  // Build a map from blockStateHash to collisionShape and outlineShape
  const hashToCollisionShape = {}
  const hashToOutlineShape = {}
  for (const state of blockStatesJSON) {
    hashToCollisionShape[state.blockStateHash] = state.collisionShape || []
    hashToOutlineShape[state.blockStateHash] = state.outlineShape || []
  }

  // Normalize shape to array of boxes format
  function normalizeShape(shape) {
    if (!shape || shape.length === 0) {
      // Empty shape -> [[0, 0, 0, 0, 0, 0]]
      return [[0, 0, 0, 0, 0, 0]]
    }
    // Check if it's already an array of boxes or a single box
    if (Array.isArray(shape[0])) {
      // Already array of boxes
      return shape
    }
    // Single box [x1, y1, z1, x2, y2, z2] -> [[x1, y1, z1, x2, y2, z2]]
    return [shape]
  }

  // Build a map to deduplicate shapes (collision and visual combined)
  const shapeToIndex = new Map()
  let nextShapeIndex = 0

  function getShapeIndex(shape) {
    const normalized = normalizeShape(shape)
    const key = JSON.stringify(normalized)
    if (shapeToIndex.has(key)) {
      return shapeToIndex.get(key)
    }
    const index = nextShapeIndex++
    shapeToIndex.set(key, index)
    collisions.shapes[index] = normalized
    return index
  }

  // Build a map from block name to array of block state hashes (ordered by stateId)
  const blockNameToStateHashes = {}
  for (const state of blockStatesJSON) {
    const name = strip(state.name)
    if (!blockNameToStateHashes[name]) {
      blockNameToStateHashes[name] = []
    }
    blockNameToStateHashes[name].push({
      hash: state.blockStateHash,
      shape: state.collisionShape || [],
      outlineShape: state.outlineShape || []
    })
  }

  // FIRST: Process all static blocks to assign shape indices 0-N
  for (const bedrockBlockIndex in blocksJSON) {
    const bedrockBlock = blocksJSON[bedrockBlockIndex]
    const blockName = strip(bedrockBlock.name)
    const shapeType = getShapeType(blockName)

    // Skip dynamic blocks in this pass
    if (shapeType && dynamicShapes && dynamicShapes[shapeType]) {
      //continue
    }

    // Static block - get shapes from block_states.json
    const stateData = blockNameToStateHashes[blockName]
    if (!stateData || stateData.length === 0) {
      console.warn(`No state data found for block: ${blockName}`)
      collisions.blocks[blockName] = [getShapeIndex([])]
      collisions.visualBlocks[blockName] = [getShapeIndex([])]
      continue
    }

    // Map each state to both collision and outline shape indices
    // Both use the same getShapeIndex function for unified deduplication
    const collisionIndices = []
    const outlineIndices = []
    for (const state of stateData) {
      const collisionIndex = getShapeIndex(state.shape)
      const outlineIndex = getShapeIndex(state.outlineShape)
      collisionIndices.push(collisionIndex)
      outlineIndices.push(outlineIndex)
    }
    collisions.blocks[blockName] = collisionIndices
    collisions.visualBlocks[blockName] = outlineIndices
  }

  // SECOND: Add dynamic shapes at the end (after all static shapes)
  // Dynamic shapes get dedicated indices and are NOT deduplicated with static shapes
  if (dynamicShapes) {
    for (const type of ['fence', 'pane', 'stairs', 'chorus']) {
      if (dynamicShapes[type]) {
        const shapeIndices = []
        for (const [idx, shape] of Object.entries(dynamicShapes[type])) {
          // Always create a new index for dynamic shapes (no deduplication)
          const shapeIndex = nextShapeIndex++
          collisions.shapes[shapeIndex] = shape
          shapeIndices[parseInt(idx)] = shapeIndex
        }
        collisions.dynamicShapes[type] = shapeIndices
      }
    }
  }

  // THIRD: Process dynamic blocks and assign them shapeType references
  for (const bedrockBlockIndex in blocksJSON) {
    const bedrockBlock = blocksJSON[bedrockBlockIndex]
    const blockName = strip(bedrockBlock.name)
    const shapeType = getShapeType(blockName)

    // if (shapeType && dynamicShapes && dynamicShapes[shapeType]) {
    //   // Dynamic block - reference the shapeType instead of storing shapes per state
    //   collisions.blocks[blockName] = { shapeType }
    // }
  }

  // Use custom serializer with configurable inline rules
  const serialized = customJSONStringify(collisions, {
    indent: '\t',
    inline: {
      blockArrays: true,        // Keep block shape index arrays inline
      shapeArrays: true,         // Keep shape coordinate arrays inline
      dynamicShapes: true,       // Keep dynamicShapes object inline
      maxLength: 10000           // Max length for inline arrays
    }
  })

  fs.writeFileSync(outputPath + '/blockCollisionShapes.json', serialized)
  fs.writeFileSync(outputPath + '/minecraft-data/blockCollisionShapes.json', serialized)

  console.log(`Generated collision data with ${Object.keys(collisions.blocks).length} blocks and ${Object.keys(collisions.shapes).length} shapes (collision + visual combined)`)
}

// Export: automatically selects V1, V2, or V3 based on available data
async function generateCollisionData(version, outputPath, dataPath) {
  // Default dataPath if not provided
  if (!dataPath) {
    dataPath = outputPath.replace('output', 'data')
  }

  const blockStatesPath = dataPath + '/block_states.json'
  const dynamicShapesPaths = [
    outputPath + '/dynamic_collision_shapes.json',
    dataPath + '/dynamic_collision_shapes.json'
  ]
  const collisionsNbtPath = './src/deps/mappings-generator/mappings/collisions.nbt'
  const hasDynamicShapes = dynamicShapesPaths.some(p => fs.existsSync(p))
  const hasBlockStates = fs.existsSync(blockStatesPath)

  if (hasBlockStates) {
    console.log('Using V3 collision data generator (from block_states.json)')
    return await createCollisionDataV3(version, outputPath, dataPath)
  } else if (fs.existsSync(collisionsNbtPath)) {
    console.log('Using V2 collision data generator (from collisions.nbt)')
    return await createCollisionDataV2(version, outputPath)
  } else {
    console.log('Using V1 collision data generator (legacy)')
    return await createCollisionDataV1(version, outputPath)
  }
}

module.exports = generateCollisionData
module.exports.DYNAMIC_BLOCK_TYPES = DYNAMIC_BLOCK_TYPES
module.exports.getShapeType = getShapeType

if (!module.parent) generateCollisionData(null, '1.17.10')