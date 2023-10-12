export default [
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
        root:
          level1:
            level2:
              target: "We are here!"
            destination: g::../level1/level2/target
        `,
        description: 'Test 3: Going up multiple levels'
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
    },
    {
        content: `
        items:
          - name: Laptop
            user: g::../../users.[0].name
          - name: Mobile
            user: g::../../users.[1].name
        users:
          - name: Bob
          - name: Alice
        `,
        description: 'Test 5: Mapping array items to another array'
    },
    {
        content: `
        settings:
          region: EU
          server: g::../locations.EU
        locations:
          EU: "eu.server.com"
          US: "us.server.com"
        `,
        description: 'Test 6: Using a key value to get another'
    },
    {
        content: `
        details:
          name: Alice
          age: 30
          stats:
            height: 165
            weight: g::../age
        `,
        description: 'Test 7: Fetching values from upper levels'
    },
    {
        content: `
        cities:
          - New York
          - London
          - g::../countries.France
        countries:
          France: Paris
          Japan: Tokyo
        `,
        description: 'Test 8: Using a key from one array to fetch a value from another object'
    },
    {
        content: `
        data:
          key1: Value 1
          key2: Value 2
          info: g::./key1
        `,
        description: 'Test 9: Self referencing within the same level'
    },
    {
        content: `
        team:
          leader: Bob
          members:
            - Alice
            - Charlie
            - g::../leader
        `,
        description: 'Test 10: Referencing a value from the parent object in an array'
    }
];