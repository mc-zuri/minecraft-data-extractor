# Bedrock Collision Shapes - Summary

## Problem

Bedrock Edition collapses multiple Java block states into single states. Collision shapes that depend on neighbors (fences, panes, stairs, chorus) must be extracted dynamically.

## Blocks Requiring Dynamic Extraction

| Type | Count | Shapes | Index Formula |
|------|-------|--------|---------------|
| Fences | 13 | 16 | `N*1 + S*2 + E*4 + W*8` |
| Panes | 26 | 16 | `N*1 + S*2 + E*4 + W*8` |
| Stairs | 55+ | 40 | `direction*10 + half*5 + shape` |
| Chorus | 1 | 64 | `down*1 + east*2 + north*4 + south*8 + up*16 + west*32` |

## Blocks NOT Requiring Extraction

- **Walls** - State preserved in Bedrock
- **Mushroom blocks** - Always full block collision
- **Fire/Redstone/Tripwire** - No collision

## Output Format

```json
{
  "blocks": {
    "stone": [1],
    "oak_fence": { "shapeType": "fence", "shapes": [82, 83, ...] }
  },
  "shapes": { "0": [], "1": [[0,0,0,1,1,1]], ... }
}
```

## Workflow

1. Run `/collisiondynamic` in Endstone server
2. Copy `dynamic_collision_shapes.json` to `output/1.21.130/`
3. Run `node src/collision.js`

## Files

| File | Purpose |
|------|---------|
| `src/collision.js` | V3 generator with shapeType support |
| `enstone-plugin/collision-plugin/` | Dynamic shape extraction plugin |
| `src/analyze-collapsed-states.js` | Find blocks with collapsed Java states |
