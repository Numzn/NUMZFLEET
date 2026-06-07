import { collectOverview } from './collector.js';

collectOverview()
  .then((o) => {
    console.log(JSON.stringify(o, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
