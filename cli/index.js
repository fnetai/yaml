import Node from "../src";

import setterTests from "./test/setter";
import getterSelfTest from "./test/getter-self";

import path from "node:path";

export default async () => {

    // const tests=[getterSelfTest[8]];

    // const tests = [...setterTests, ...getterSelfTest]

    // for (const test of tests) {
    //     console.log(`---- Running: ${test.description} ----`);
    //     console.log(test.content);
    //     const result = await Node({ content: test.content });
    //     console.log('<->');
    //     console.log(result.content);
    //     console.log('---------------------------------------');
    // }

    const file = path.resolve(process.cwd(), '../cli/test/files/data.yaml');
    const result = await Node({ file });
    console.log(result);
}