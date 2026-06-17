const fs = require("fs");
const strip = (k) => k.replace("minecraft:", "").split("[")[0];
const tfi = (inp) => JSON.stringify(inp);
const stringify = require("json-stringify-pretty-compact");

function swapUuidByteOrder(uuid) {
  const hex = uuid.replace(/-/g, '');
  const rev = s => s.match(/.{2}/g).reverse().join('');
  const c = rev(hex.slice(0, 16)) + rev(hex.slice(16));
  return `${c.slice(0,8)}-${c.slice(8,12)}-${c.slice(12,16)}-${c.slice(16,20)}-${c.slice(20)}`;
}

function flatten(input) {
  const ing = [];
  const counts = {};
  let result = [];
  if (Array.isArray(input[0])) {
    for (let i = 0; i < input.length; i++) {
      let inp1 = input[i];
      let newInpArray = [];
      for (let j = 0; j < inp1.length; j++) {
        let inp2 = inp1[j];
        if (inp2.type === 'invalid' || (!inp2.network_id && !inp2.tag)) {
          newInpArray.push(0);
          continue;
        }
        const ingredient = tfi(inp2);
        if (!ing.includes(ingredient)) ing.push(ingredient);
        counts[ingredient] ??= 0;
        counts[ingredient]++;
        newInpArray.push(ing.indexOf(ingredient) + 1);
      }
      result.push(newInpArray);
    }
  } else {
    let newInpArray = [];
    for (let j = 0; j < input.length; j++) {
      let inp2 = input[j];
      if (inp2.type === 'invalid' || (!inp2.network_id && !inp2.tag)) {
        newInpArray.push(0);
        continue;
      }
      const ingredient = tfi(inp2);
      if (!ing.includes(ingredient)) ing.push(ingredient);
      counts[ingredient] ??= 0;
      counts[ingredient]++;
      newInpArray.push(ing.indexOf(ingredient) + 1);
    }
    result.push(newInpArray);
  }
  const ing2 = ing.map((e) => {
    const x = JSON.parse(e);
    x.count = counts[e] || x.count;
    return x;
  });
  return [ing2, result];
}

module.exports = (version, outputPath, dataDir) => {
  const craftingData = require(`${dataDir}/packets/crafting_data.json`);
  const itemstates =
    require(`${dataDir}/packets/item_registry.json`).itemstates;
  const uniqueTypes = new Set();

  let itemRuntimeId2String = {};

  for (const state of itemstates) {
    itemRuntimeId2String[state.runtime_id] = state.name;
  }

  // Build multi recipe enrichment map from server dump (in packets/ to avoid overwrite by output)
  const serverDump = require(`${dataDir}/recipes.json`);
  const multiMap = new Map();
  if (serverDump.multi) {
    for (const m of serverDump.multi) {
      multiMap.set(m.uuid, { name: m.id, tag: m.tag });
    }
  }

  const makeOutputItem = (_it) => {
    let it = typeof _it === "string" ? JSON.parse(_it) : _it;

    if (_it.network_id !== undefined) {
      const name = itemRuntimeId2String[it.network_id];
      if (!name) {
        throw Error(it.network_id);
      }
      const item = {
        name: strip(name ?? it.network_id),
        network_id: it.network_id,
        metadata: it.metadata,
        count: it.count ?? 1,
        type: it.type,
        nbt: it.extra?.nbt,
      };
      if (it.block_runtime_id) item.block_runtime_id = it.block_runtime_id;
      return item;
    } else if (_it.type == "item_tag") {
      return {
        name: strip(it.tag),
        metadata: it.metadata,
        count: it.count ?? 1,
        type: it.type,
        nbt: it.extra?.nbt,
      };
    } else {
      console.error(it.type + " is not support");
    }
  };

  let ret = [];

  for (let id in craftingData.recipes) {
    const recipe = craftingData.recipes[id];
    id = parseInt(id);
    uniqueTypes.add(recipe.recipe.block);
    uniqueTypes.add(recipe.type);
    const name = recipe.recipe.recipe_id;
    if (
      [
        "shapeless",
        "shaped",
        "shaped_chemistry",
        "shapeless_chemistry",
      ].includes(recipe.type)
    ) {
      const [ing, inp] = flatten(recipe.recipe.input);
      const block = recipe.recipe.block === 'deprecated' ? undefined : recipe.recipe.block;
      ret.push({
        type: block || recipe.type,
        id,
        name,
        network_id: recipe.recipe.network_id,
        ingredients: ing.map(makeOutputItem),
        input: inp,
        output: recipe.recipe.output.map(makeOutputItem),
      });
    } else if (
      recipe.type === "furnace" ||
      recipe.type === "furnace_with_metadata"
    ) {
      const name = itemRuntimeId2String[recipe.recipe.input_id];
      const furnaceBlock = recipe.recipe.block === 'deprecated' ? 'furnace' : recipe.recipe.block;
      ret.push({
        type: furnaceBlock || "furnace",
        id,
        name,
        ingredients: [
          { name: strip(name), metadata: recipe.recipe.metadata, count: 1 },
        ],
        output: [makeOutputItem(recipe.recipe.output)],
      });
    } else if (recipe.type === "multi") {
      const uuid = swapUuidByteOrder(recipe.recipe.uuid);
      const enrichment = multiMap.get(uuid) || {};
      ret.push({
        type: 'multi',
        id,
        name: enrichment.name || uuid,
        network_id: recipe.recipe.network_id,
        uuid,
        tag: enrichment.tag,
      });
    } else if (recipe.type === "shulker_box") {
      const [ing, inp] = flatten(recipe.recipe.input);
      ret.push({
        type: "shulker_box",
        id,
        name,
        network_id: recipe.recipe.network_id,
        ingredients: ing.map(makeOutputItem),
        input: inp,
        output: recipe.recipe.output.map(makeOutputItem),
        priority: recipe.recipe.priority,
      });
    } else if (recipe.type === "smithing_trim") {
      ret.push({
        type: 'smithing_table',
        id,
        name,
        network_id: recipe.recipe.network_id,
        block: recipe.recipe.block,
        template: makeOutputItem(recipe.recipe.template),
        input: makeOutputItem(recipe.recipe.input),
        addition: makeOutputItem(recipe.recipe.addition),
      });
    } else if (recipe.type === "smithing_transform") {
      ret.push({
        type: 'smithing_table',
        id,
        name,
        network_id: recipe.recipe.network_id,
        tag: recipe.recipe.tag,
        template: makeOutputItem(recipe.recipe.template),
        base: makeOutputItem(recipe.recipe.base),
        addition: makeOutputItem(recipe.recipe.addition),
        result: makeOutputItem(recipe.recipe.result),
      });
    } else {
      throw Error(recipe.type + " is not support");
    }
  }

  const final = {};
  for (const r of ret) {
    final[r.id] = r;
    delete r.id;
  }

  fs.writeFileSync(
    outputPath + "/recipes.json",
    stringify(final, { indent: 2, maxLength: 200 })
  );
};

if (!module.parent) module.exports(null, process.argv[2] || "./output");
