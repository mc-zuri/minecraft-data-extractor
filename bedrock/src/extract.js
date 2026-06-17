const path = require('path')

async function run(version, javaVersion, outputDir = path.resolve(__dirname, '..', './output', version), dataDir = path.resolve(__dirname, '..', './data', version)) {
  await require('./blockMap')(version, outputDir, dataDir, javaVersion)
  await require('./blocks')(version, outputDir, dataDir, javaVersion)
  await require('./collision')(version, outputDir, dataDir, javaVersion)
  await require('./itemMap')(version, outputDir, dataDir, javaVersion)
  await require('./items')(version, outputDir, dataDir, javaVersion)
  //await require('./biomeMap')(version, outputDir, dataDir)
  //await require('./biomes')(version, outputDir, dataDir)
  //await require('./recipe')(version, outputDir, dataDir)
  //await require('./multi_recipes')(version, outputDir, dataDir)



  //console.log('🧟‍♂️ Generating entities')
  //await require('./entities')(version, outputDir, dataDir)
}

run('1.26.20', '1.26.1')
run('1.26.10', '1.26.1')
run('1.26.0', '1.26.1')