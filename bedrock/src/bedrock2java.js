const { strict } = require("assert")

module.exports = async (version, outputPath, dataDir) => {
    const stringify = require("json-stringify-pretty-compact")
    const fs = require('fs')
    const javaRegistry = require('prismarine-registry')('1.21.8')
    const JavaBlock = require('prismarine-block')(javaRegistry)
    const J2B = require(`${outputPath}/blocks/Java2Bedrock.json`)

    const j2b = {};

    for (const [key, value] of Object.entries(J2B)) {
        try {
            if (j2b[value] == null) {
                j2b[value] = new Set([key.replace('waterlogged=true').replace('waterlogged=false')]);
            } else {
                j2b[value].add(key.replace('waterlogged=true').replace('waterlogged=false'))
            }
        }
        catch { }
    }

    const keys = [];
    for (const [key, value] of Object.entries(j2b)) {
        if (Array.from(value).length == 1 
        || key.includes('_stairs') || key.includes('snowy') || key.includes('_sign') || key.includes('_trapdoor') || key.includes('_door') || key.includes('_wall') || key.includes('_shelf')
            || key.includes('_slab') || key.includes('_candle') 
        || key.includes('_chest') || key.includes('_pane') || key.includes('_fence') || key.includes('_button') || key.includes('_leaves') || key.includes('_fence'
        || Array.from(value).find(f => f.includes('snowy')))
            ) {
            continue;
        }
        keys.push(key);
    }

    fs.writeFileSync(outputPath + '/b2j.json', stringify(j2b, { indent: '\t', maxLength: 19999 }))
}

if (!module.parent) module.exports(null, '1.17.10')