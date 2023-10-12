import Node from "../src";
import setterTests from "./setter-tests";
import getterTests from "./getter-tests";

export default async () => {

    console.log(process.cwd());
    
    const currentTests = getterTests;

    for (const test of currentTests) {
        console.log(`---- Running: ${test.description} ----`);
        const result = await Node({ yamlContent: test.content });
        console.log(result);
        console.log('---------------------------------------');
    }
}