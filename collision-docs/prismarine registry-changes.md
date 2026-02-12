# Bedrock Block Collision Shapes - Implementation Documentation

## Problem Statement

Bedrock has block types where the same block state has different collision shapes based on neighbors and direction. Java Edition stores these as separate block states, but Bedrock collapses them into fewer states and determines collision dynamically.

## Analysis Results

### Java vs Bedrock State Comparison

| Block | Java States | Bedrock States | Missing Shapes |
|-------|-------------|----------------|----------------|
| oak_stairs | 80 | 8 | 5 corner shapes per state |
| oak_fence | 32 | 1 | 16 neighbor shapes |
| glass_pane | 32 | 1 | 16 neighbor shapes |
| chorus_plant | 64 | 1 | 64 neighbor shapes |
| cobblestone_wall | 324 | 162 | None (state preserved) |

### Blocks Requiring Dynamic Collision Extraction

1. **Fences** (13 types) - 16 shapes each based on N/S/E/W neighbors
2. **Panes** (26 types) - 16 shapes each based on N/S/E/W neighbors
   - Glass pane, iron bars, 16 stained glass panes
   - 8 copper bar variants (copper_bars, exposed/weathered/oxidized, waxed variants)
3. **Stairs** (55+ types) - 40 shapes each (8 base states x 5 corner shapes)
4. **Chorus Plant** - 64 shapes based on 6 directional connections

### Blocks NOT Requiring Dynamic Extraction

- **Walls** - Connection states preserved in Bedrock (`wall_connection_type_*`)
- **Vines** - State preserved in Bedrock (`vine_direction_bits`)
- **Mushroom Blocks** - Always full block collision (shape 1) regardless of visible faces
- **Fire/Redstone/Tripwire** - No collision shapes

## Dynamic Shape Indexing

### Fence/Pane Index (0-15)

Fences and panes use a **4-bit bitmask** based on cardinal neighbor connections:

```
Bit 0 (1) = North connection (-Z)
Bit 1 (2) = South connection (+Z)
Bit 2 (4) = East connection  (+X)
Bit 3 (8) = West connection  (-X)
```

**Index formula**: `index = N*1 + S*2 + E*4 + W*8`

| Index | Binary | Connections | Description |
|-------|--------|-------------|-------------|
| 0 | 0000 | None | Center post only |
| 1 | 0001 | N | North arm |
| 2 | 0010 | S | South arm |
| 3 | 0011 | N+S | North-South corridor |
| 4 | 0100 | E | East arm |
| 5 | 0101 | N+E | Corner (NE) |
| 6 | 0110 | S+E | Corner (SE) |
| 7 | 0111 | N+S+E | T-junction |
| 8 | 1000 | W | West arm |
| 9 | 1001 | N+W | Corner (NW) |
| 10 | 1010 | S+W | Corner (SW) |
| 11 | 1011 | N+S+W | T-junction |
| 12 | 1100 | E+W | East-West corridor |
| 13 | 1101 | N+E+W | T-junction |
| 14 | 1110 | S+E+W | T-junction |
| 15 | 1111 | All | Cross (+) |

**Connection rules**: A fence/pane connects to a neighbor if:
- Neighbor is a solid block (`boundingBox === 'block'`)
- Neighbor is the same block type
- Neighbor is another fence (for fences) or pane (for panes)

### Stair Index (0-39)

Stairs use a **combined index** based on facing, half, and corner shape:

```
Index = weirdo_direction * 10 + half * 5 + shape_type
```

**Components**:

| Component | Values | Description |
|-----------|--------|-------------|
| `weirdo_direction` | 0-3 | 0=East, 1=West, 2=South, 3=North |
| `half` | 0-1 | 0=Bottom, 1=Top (upside_down_bit) |
| `shape_type` | 0-4 | 0=Straight, 1=Inner Left, 2=Inner Right, 3=Outer Left, 4=Outer Right |

**Index table**:

| Index | Facing | Half | Shape |
|-------|--------|------|-------|
| 0 | East | Bottom | Straight |
| 1 | East | Bottom | Inner Left |
| 2 | East | Bottom | Inner Right |
| 3 | East | Bottom | Outer Left |
| 4 | East | Bottom | Outer Right |
| 5 | East | Top | Straight |
| 6 | East | Top | Inner Left |
| 7 | East | Top | Inner Right |
| 8 | East | Top | Outer Left |
| 9 | East | Top | Outer Right |
| 10-19 | West | ... | ... |
| 20-29 | South | ... | ... |
| 30-39 | North | ... | ... |

**Corner detection**:
- **Inner corner**: Adjacent stair in front, facing perpendicular (forms L-shape, fills corner)
- **Outer corner**: Adjacent stair behind, facing perpendicular (forms L-shape, cuts notch)
- **Left/Right**: Determined by turn direction from main stair to adjacent stair

### Chorus Plant Index (0-63)

Chorus plants use a **6-bit bitmask** based on all 6 directional connections:

```
Index = down*1 + east*2 + north*4 + south*8 + up*16 + west*32

Bit 0 (1)  = Down  (-Y)
Bit 1 (2)  = East  (+X)
Bit 2 (4)  = North (-Z)
Bit 3 (8)  = South (+Z)
Bit 4 (16) = Up    (+Y)
Bit 5 (32) = West  (-X)
```

**Connection rules**: A chorus plant connects to a neighbor if:
- Neighbor is another chorus plant
- Neighbor is a chorus flower
- Neighbor is end stone (for down direction)

## Output Format

### blockCollisionShapes.json

```json
{
  "blocks": {
    "stone": [1],
    "oak_fence": {
      "shapeType": "fence",
      "shapes": [82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97]
    },
    "glass_pane": {
      "shapeType": "pane",
      "shapes": [111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126]
    },
    "oak_stairs": {
      "shapeType": "stairs",
      "shapes": [/* 40 shape indices */]
    },
    "chorus_plant": {
      "shapeType": "chorus",
      "shapes": [/* 64 shape indices */]
    }
  },
  "shapes": {
    "0": [],
    "1": [[0, 0, 0, 1, 1, 1]],
    "82": [[0.375, 0.0, 0.375, 0.625, 1.5, 0.625]]
  }
}
```

**Format explanation:**
- Blocks without `shapeType`: Use standard array of indices per state
- Blocks with `shapeType`: Have dynamic shapes indexed by neighbor configuration
- `shapeType` values: `"fence"`, `"pane"`, `"stairs"`, `"chorus"`

## Extracting Dynamic Shapes

### Using Endstone Plugin

1. Start Bedrock server with Endstone
2. Run: `/collisiondynamic`
3. Output: `dynamic_collision_shapes.json`

```bash
# In Bedrock server with Endstone
/collisiondynamic
```

### Generated Files

- `collision_shapes.json` - Static collision shapes for all blocks
- `dynamic_collision_shapes.json` - Dynamic shapes with neighbor variations

## Implementation Files

| File | Purpose |
|------|---------|
| `bedrock/src/collision.js` | V1/V2/V3 collision data generators |
| `bedrock/enstone-plugin/collision-plugin/collision_extractor/__init__.py` | Endstone plugin for shape extraction |
| `bedrock/output/1.21.130/minecraft-data/blockCollisionShapes.json` | Final output |

## Version History

- V1: Legacy collision mapping from geyser blocks.json
- V2: NBT-based collision data from mappings-generator
- V3: Dynamic shapes with shapeType format (current)
