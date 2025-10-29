const path = require('path')

async function run(version, outputDir = path.resolve(__dirname, '..', './output', version), dataDir = path.resolve(__dirname, '..', './data', version)) {
  //console.log('🔻 Downloading dependencies...')
  // await require('./deps')(version, outputDir, dataDir)
  console.log('🔁 Generating block map')
  await require('./blockMap')(version, outputDir, dataDir)
  console.log('🧱 Generating block list')
  await require('./blocks')(version, outputDir, dataDir)

  console.log('💥 Generating collision data')
  await require('./collision')(version, outputDir, dataDir)

  console.log('🔨 Generating item map + list')
  await require('./itemMap')(version, outputDir, dataDir)
  await require('./items')(version, outputDir, dataDir)

  //console.log('🌎 Generating biome map + list')
  //await require('./biomeMap')(version, outputDir, dataDir)
  //await require('./biomes')(version, outputDir, dataDir)

  //console.log('👩‍🍳 Generating recipes')
  //await require('./recipe')(version, outputDir, dataDir)

  console.log('🧟‍♂️ Generating entities')
  //await require('./entities')(version, outputDir, dataDir)
}

module.exports = run
if (!module.parent) run('1.21.120')