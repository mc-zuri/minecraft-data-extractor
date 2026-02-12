# Dynamic Collision Shapes

## Overview

The `dynamicShapes` field in `blockCollisionShapes.json` contains collision shape indices for blocks whose collision depends on neighboring blocks. These blocks are **not** included in the `blocks` section to avoid data duplication.

## Structure

```json
{
  "blocks": { /* static blocks only */ },
  "shapes": { /* all shape definitions */ },
  "dynamicShapes": {
    "fence": [326, 327, ..., 341],   // 16 indices
    "pane": [342, 343, ..., 357],    // 16 indices
    "stairs": [358, 359, ..., 397],  // 40 indices
    "chorus": [398, 399, ..., 461]   // 64 indices
  }
}
```

## Block Types

| Type | Blocks | Shape Count |
|------|--------|-------------|
| fence | oak_fence, spruce_fence, birch_fence, jungle_fence, acacia_fence, cherry_fence, dark_oak_fence, pale_oak_fence, mangrove_fence, bamboo_fence, nether_brick_fence, crimson_fence, warped_fence | 16 |
| pane | glass_pane, iron_bars, all stained_glass_pane variants, copper_bars variants | 16 |
| stairs | All stair variants (oak_stairs, stone_stairs, etc.) | 40 |
| chorus | chorus_plant | 64 |

## Index Calculation

### Fence & Pane (16 shapes)

4-bit bitmask based on cardinal connections:

```
index = north + south*2 + east*4 + west*8
```

| Bit | Value | Direction | Axis |
|-----|-------|-----------|------|
| 0 | 1 | North | -Z |
| 1 | 2 | South | +Z |
| 2 | 4 | East | +X |
| 3 | 8 | West | -X |

**Examples:**
| Index | Connections | Description |
|-------|-------------|-------------|
| 0 | None | Center post only |
| 3 | N+S | North-South corridor |
| 12 | E+W | East-West corridor |
| 15 | All | Cross (+) |

**Code:**
```javascript
function getFencePaneIndex(north, south, east, west) {
  return (north ? 1 : 0) + (south ? 2 : 0) + (east ? 4 : 0) + (west ? 8 : 0)
}

// Get shape for fence
const index = getFencePaneIndex(hasNorth, hasSouth, hasEast, hasWest)
const shapeIndex = collisionShapes.dynamicShapes.fence[index]
const shape = collisionShapes.shapes[shapeIndex]
```

### Stairs (40 shapes)

Combined index based on facing direction, half (top/bottom), and corner shape:

```
index = direction*10 + half*5 + shape
```

| Component | Values | Description |
|-----------|--------|-------------|
| direction | 0-3 | 0=East, 1=West, 2=South, 3=North |
| half | 0-1 | 0=Bottom, 1=Top (upside_down_bit) |
| shape | 0-4 | 0=Straight, 1=Inner Left, 2=Inner Right, 3=Outer Left, 4=Outer Right |

**Index table:**
| Index | Direction | Half | Shape |
|-------|-----------|------|-------|
| 0-4 | East | Bottom | Straight to Outer Right |
| 5-9 | East | Top | Straight to Outer Right |
| 10-14 | West | Bottom | Straight to Outer Right |
| 15-19 | West | Top | Straight to Outer Right |
| 20-24 | South | Bottom | Straight to Outer Right |
| 25-29 | South | Top | Straight to Outer Right |
| 30-34 | North | Bottom | Straight to Outer Right |
| 35-39 | North | Top | Straight to Outer Right |

**Code:**
```javascript
function getStairIndex(direction, upsideDown, shape) {
  // direction: 0=East, 1=West, 2=South, 3=North
  // upsideDown: boolean
  // shape: 0=straight, 1=inner_left, 2=inner_right, 3=outer_left, 4=outer_right
  return direction * 10 + (upsideDown ? 5 : 0) + shape
}

// Get shape for stair
const index = getStairIndex(weirdoDirection, upsideDownBit, cornerShape)
const shapeIndex = collisionShapes.dynamicShapes.stairs[index]
const shape = collisionShapes.shapes[shapeIndex]
```

**Corner shape detection:**
- **Straight**: No adjacent stair forming corner
- **Inner Left/Right**: Adjacent stair in front, perpendicular facing (fills corner)
- **Outer Left/Right**: Adjacent stair behind, perpendicular facing (cuts notch)

### Chorus Plant (64 shapes)

6-bit bitmask based on all 6 directional connections:

```
index = down + east*2 + north*4 + south*8 + up*16 + west*32
```

| Bit | Value | Direction | Axis |
|-----|-------|-----------|------|
| 0 | 1 | Down | -Y |
| 1 | 2 | East | +X |
| 2 | 4 | North | -Z |
| 3 | 8 | South | +Z |
| 4 | 16 | Up | +Y |
| 5 | 32 | West | -X |

**Code:**
```javascript
function getChorusIndex(down, east, north, south, up, west) {
  return (down ? 1 : 0) + (east ? 2 : 0) + (north ? 4 : 0) +
         (south ? 8 : 0) + (up ? 16 : 0) + (west ? 32 : 0)
}

// Get shape for chorus plant
const index = getChorusIndex(hasDown, hasEast, hasNorth, hasSouth, hasUp, hasWest)
const shapeIndex = collisionShapes.dynamicShapes.chorus[index]
const shape = collisionShapes.shapes[shapeIndex]
```

**Connection rules:**
- Connects to adjacent chorus_plant
- Connects to adjacent chorus_flower
- Connects down to end_stone

## Usage Example

```javascript
const collisionShapes = require('./blockCollisionShapes.json')

function getBlockCollision(blockName, neighbors) {
  // Check if block uses dynamic shapes
  if (blockName.endsWith('_fence') || blockName === 'nether_brick_fence') {
    const index = getFencePaneIndex(neighbors.north, neighbors.south, neighbors.east, neighbors.west)
    return collisionShapes.shapes[collisionShapes.dynamicShapes.fence[index]]
  }

  if (blockName.endsWith('_pane') || blockName === 'iron_bars' || blockName.includes('copper_bars')) {
    const index = getFencePaneIndex(neighbors.north, neighbors.south, neighbors.east, neighbors.west)
    return collisionShapes.shapes[collisionShapes.dynamicShapes.pane[index]]
  }

  if (blockName.endsWith('_stairs')) {
    const index = getStairIndex(neighbors.direction, neighbors.upsideDown, neighbors.cornerShape)
    return collisionShapes.shapes[collisionShapes.dynamicShapes.stairs[index]]
  }

  if (blockName === 'chorus_plant') {
    const index = getChorusIndex(neighbors.down, neighbors.east, neighbors.north,
                                  neighbors.south, neighbors.up, neighbors.west)
    return collisionShapes.shapes[collisionShapes.dynamicShapes.chorus[index]]
  }

  // Static block - use blocks section
  const stateIndex = blockStateId - block.minStateId
  return collisionShapes.shapes[collisionShapes.blocks[blockName][stateIndex]]
}
```

## Prismarine/Mineflayer Implementation

Example implementation for applying dynamic collision shapes in a bot/client library:

```typescript
function applyDynamicCollisionShapes(bot, block) {
  const collisionShapes = bot.registry.blockCollisionShapes
  const blockType = bot.registry.blocksByStateId[block.stateId]

  // Determine shape type from block name
  const shapeType = getShapeType(blockType.name)
  if (!shapeType) return block

  const dynamicShapes = collisionShapes.dynamicShapes?.[shapeType]
  if (!dynamicShapes) return block

  let shapeIndex: number

  if (shapeType === 'stairs') {
    // Stairs: direction*10 + half*5 + cornerShape
    const direction = block.getProperties().weirdo_direction ?? 0
    const upsideDown = block.getProperties().upside_down_bit ? 1 : 0
    const cornerShape = calculateStairCornerShape(bot, block)
    shapeIndex = direction * 10 + upsideDown * 5 + cornerShape
  }
  else if (shapeType === 'chorus') {
    // Chorus: 6-direction bitmask
    const pos = block.position
    shapeIndex = 0
    const directions = [
      { dy: -1, bit: 1 },   // Down
      { dx: 1, bit: 2 },    // East
      { dz: -1, bit: 4 },   // North
      { dz: 1, bit: 8 },    // South
      { dy: 1, bit: 16 },   // Up
      { dx: -1, bit: 32 }   // West
    ]
    for (const { dx = 0, dy = 0, dz = 0, bit } of directions) {
      const neighbor = bot.world.getBlock(pos.offset(dx, dy, dz))
      if (neighbor) {
        const name = bot.registry.blocksByStateId[neighbor.stateId]?.name
        const connects = name === 'chorus_plant' || name === 'chorus_flower' ||
                        (bit === 1 && name === 'end_stone')
        if (connects) shapeIndex |= bit
      }
    }
  }
  else {
    // Fences/Panes: 4-direction bitmask (N=1, S=2, E=4, W=8)
    const pos = block.position
    shapeIndex = 0
    const directions = [
      { dx: 0, dz: -1, bit: 1 },   // North
      { dx: 0, dz: 1, bit: 2 },    // South
      { dx: 1, dz: 0, bit: 4 },    // East
      { dx: -1, dz: 0, bit: 8 }    // West
    ]

    for (const { dx, dz, bit } of directions) {
      const neighbor = bot.world.getBlock(pos.offset(dx, 0, dz))
      if (neighbor) {
        const neighborType = bot.registry.blocksByStateId[neighbor.stateId]
        const neighborShapeType = getShapeType(neighborType?.name)
        const isSolid = neighbor.boundingBox === 'block'
        const isSameType = neighbor.stateId === block.stateId
        const connectsFence = shapeType === 'fence' && neighborShapeType === 'fence'
        const connectsPane = shapeType === 'pane' && neighborShapeType === 'pane'

        if (isSolid || isSameType || connectsFence || connectsPane) {
          shapeIndex |= bit
        }
      }
    }
  }

  const shapeId = dynamicShapes[shapeIndex]
  if (shapeId !== undefined) {
    block.shapes = collisionShapes.shapes[shapeId]
  }

  return block
}

// Helper: determine shape type from block name
function getShapeType(name: string): string | null {
  if (!name) return null
  if (name.endsWith('_fence') || name === 'nether_brick_fence') return 'fence'
  if (name.endsWith('_pane') || name === 'iron_bars' || name.includes('copper_bars')) return 'pane'
  if (name.endsWith('_stairs')) return 'stairs'
  if (name === 'chorus_plant') return 'chorus'
  return null
}

// Helper: calculate stair corner shape based on neighbors
function calculateStairCornerShape(bot, block): number {
  // 0=Straight, 1=Inner Left, 2=Inner Right, 3=Outer Left, 4=Outer Right
  const pos = block.position
  const props = block.getProperties()
  const facing = props.weirdo_direction // 0=E, 1=W, 2=S, 3=N
  const upsideDown = props.upside_down_bit

  // Get front and back neighbors based on facing
  const offsets = {
    0: { front: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] },  // East
    1: { front: [-1, 0], back: [1, 0], left: [0, 1], right: [0, -1] },  // West
    2: { front: [0, 1], back: [0, -1], left: [1, 0], right: [-1, 0] },  // South
    3: { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }   // North
  }[facing]

  const frontBlock = bot.world.getBlock(pos.offset(offsets.front[0], 0, offsets.front[1]))
  const backBlock = bot.world.getBlock(pos.offset(offsets.back[0], 0, offsets.back[1]))

  // Check for inner corner (stair in front, perpendicular)
  if (frontBlock && getShapeType(bot.registry.blocksByStateId[frontBlock.stateId]?.name) === 'stairs') {
    const frontProps = frontBlock.getProperties()
    if (frontProps.upside_down_bit === upsideDown) {
      const frontFacing = frontProps.weirdo_direction
      if (isPerpendicularLeft(facing, frontFacing)) return 1  // Inner Left
      if (isPerpendicularRight(facing, frontFacing)) return 2 // Inner Right
    }
  }

  // Check for outer corner (stair behind, perpendicular)
  if (backBlock && getShapeType(bot.registry.blocksByStateId[backBlock.stateId]?.name) === 'stairs') {
    const backProps = backBlock.getProperties()
    if (backProps.upside_down_bit === upsideDown) {
      const backFacing = backProps.weirdo_direction
      if (isPerpendicularLeft(facing, backFacing)) return 3  // Outer Left
      if (isPerpendicularRight(facing, backFacing)) return 4 // Outer Right
    }
  }

  return 0 // Straight
}

function isPerpendicularLeft(facing, otherFacing) {
  // Returns true if otherFacing is 90 degrees counter-clockwise from facing
  const leftOf = { 0: 3, 1: 2, 2: 0, 3: 1 } // E->N, W->S, S->E, N->W
  return otherFacing === leftOf[facing]
}

function isPerpendicularRight(facing, otherFacing) {
  const rightOf = { 0: 2, 1: 3, 2: 1, 3: 0 } // E->S, W->N, S->W, N->E
  return otherFacing === rightOf[facing]
}
```
