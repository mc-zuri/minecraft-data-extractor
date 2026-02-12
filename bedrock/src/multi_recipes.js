const fs = require("fs");
const path = require("path");
const stringify = require("json-stringify-pretty-compact");

function swapUuidByteOrder(uuid) {
  const hex = uuid.replace(/-/g, '');
  const rev = s => s.match(/.{2}/g).reverse().join('');
  const c = rev(hex.slice(0, 16)) + rev(hex.slice(16));
  return `${c.slice(0,8)}-${c.slice(8,12)}-${c.slice(12,16)}-${c.slice(16,20)}-${c.slice(20)}`;
}

module.exports = (version, outputPath, dataDir) => {
  const craftingData = require(`${dataDir}/packets/crafting_data.json`);
  const serverDump = require(`${dataDir}/packets/recipes_server.json`);

  // Build enrichment map from server dump (canonical UUID → {name, tag, netId})
  const multiMap = new Map();
  if (serverDump.multi) {
    for (const m of serverDump.multi) {
      multiMap.set(m.uuid, { name: m.id, tag: m.tag, netId: m.netId });
    }
  }

  // Extract multi recipes from crafting_data, swap UUIDs, enrich
  const result = {};
  for (const recipe of craftingData.recipes) {
    if (recipe.type !== 'multi') continue;
    const uuid = swapUuidByteOrder(recipe.recipe.uuid);
    const enrichment = multiMap.get(uuid);
    if (!enrichment) {
      console.warn('No server enrichment for multi UUID:', uuid);
      continue;
    }
    const tag = enrichment.tag;
    if (!result[tag]) result[tag] = {};
    result[tag][enrichment.name] = {
      uuid,
      network_id: recipe.recipe.network_id,
    };
  }

  fs.writeFileSync(
    outputPath + "/multi_recipes.json",
    stringify(result, { indent: 2, maxLength: 200 })
  );
};

if (!module.parent) {
  const version = process.argv[2] || '1.21.130';
  const base = path.resolve(__dirname, '..');
  module.exports(version, path.resolve(base, 'output', version), path.resolve(base, 'data', version));
}
