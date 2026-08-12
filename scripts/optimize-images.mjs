import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();

const targets = [
  {
    dir: 'src/images',
    maxWidth: 1920,
    quality: 72,
    files: [
      'img1.jpg',
      'img2.jpg',
      'img5.jpg',
      'sanjay_img3.jpg',
      'NihitBhargava.jpg',
      'grid7.png',
      'message.png'
    ]
  },
  {
    dir: 'src/svc_img',
    maxWidth: 960,
    quality: 72,
    files: [
      'uni.png',
      'nextGen.png',
      'futureLeaders.png',
      'StrategicBusiness Growth.png',
      'caas.png'
    ]
  },
  {
    dir: 'src/industries_img',
    maxWidth: 960,
    quality: 72,
    files: [
      'Pic - Gaming Industry.png',
      'Pic - FinTech Industry.png',
      'Pic - Insurance Industry.png',
      'Pic - HealthCare.png',
      'Pic - EduTech Industry.png'
    ]
  },
  {
    dir: 'src/extra_img',
    maxWidth: 1280,
    quality: 70,
    files: [
      'AIPoweredOKRManagement.jpg',
      'BuildingLeadersForTomorrow.jpg',
      'BusinessGrowthwithAI.jpg',
      'SoftwareTestingwithAI.jpg',
      'CapacityAugmentation.jpg',
      'ProgramsForUniversities.jpg',
      'GamingIndustry.jpg',
      'Fintech.jpg',
      'Insurance.jpg',
      'HealthTech.jpg',
      'EdTechWithAI.jpg'
    ]
  }
];

function toWebpPath(filePath) {
  const ext = path.extname(filePath);
  return filePath.slice(0, -ext.length) + '.webp';
}

async function optimizeOne(sourcePath, outputPath, maxWidth, quality) {
  const input = sharp(sourcePath, { failOn: 'none' }).rotate();
  const metadata = await input.metadata();
  const width = metadata.width || maxWidth;
  const resizeWidth = Math.min(width, maxWidth);

  await input
    .resize({ width: resizeWidth, withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(outputPath);

  const [sourceStat, outputStat] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(outputPath)
  ]);

  return {
    sourcePath,
    outputPath,
    sourceBytes: sourceStat.size,
    outputBytes: outputStat.size
  };
}

async function run() {
  const results = [];

  for (const group of targets) {
    for (const fileName of group.files) {
      const sourcePath = path.join(root, group.dir, fileName);
      const outputPath = toWebpPath(sourcePath);

      try {
        const result = await optimizeOne(sourcePath, outputPath, group.maxWidth, group.quality);
        results.push(result);
      } catch (error) {
        console.warn(`Skipped ${sourcePath}: ${error.message}`);
      }
    }
  }

  let totalInput = 0;
  let totalOutput = 0;

  for (const result of results) {
    totalInput += result.sourceBytes;
    totalOutput += result.outputBytes;
  }

  const saved = totalInput - totalOutput;
  const percent = totalInput > 0 ? ((saved / totalInput) * 100).toFixed(1) : '0.0';

  console.log(`Optimized ${results.length} images.`);
  console.log(`Input: ${(totalInput / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Output: ${(totalOutput / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Saved: ${(saved / (1024 * 1024)).toFixed(2)} MB (${percent}%)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
