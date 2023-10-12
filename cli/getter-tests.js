export default [
    {
        content: `
        root:
          level1:
            level2:
              target: "We are here!"
              other: g::file://../cli/test.yaml
            destination: g::../level1/level2/target
        `,
        description: 'Test 3: Going up multiple levels'
    },    
    {
        content: `
        details:
          personal:
            name: Alice
            contact:
              phone.owner: g::../name
        `,
        description: 'Test 1: Relative path within the same document'
    },
    {
        content: `
        details:
          personal:
            name: Alice
            friends:
              - Bob
              - Charlie
            contact:
              phone.owner: g::../name
              phone.friend: g::../friends.[1]
        `,
        description: 'Test 2: Using array indices in the getter'
    },

    {
        content: `
        people:
          person1:
            name: Alice
            friends:
              - Bob
              - Charlie
            contact:
              phone.owner: g::../../person1/name
        `,
        description: 'Test 4: Relative path with multiple levels up'
    }
];
