import fnetConfig from '@fnet/config';
import Node from "../src/index.js";

export default async ({ config = "setter-basic" } = {}) => {
  const args = (await fnetConfig({ rel:"../tests", name: config })).data;
  const result = await Node(args);

  if (result) {
    console.log('\n=== Captured Output ===');
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
};

