export default [
    {
        content: `
        name: About a demo
        description: This is a demo
        s::metadata.author.name: fnet
        metadata:
          createdOn: 2020-01-01
          createdBy: fnet
          s::author.email: gultekinboyraz@gmail.com
        `,
        description: 'Test 1'
    },
    {
        content: `
        s::topLevel: some value
        nested:
          s::deeply.nested.value: A deeply nested value
        `,
        description: 'Test 2'
    },
    {
        content: `
        friends:
          s::jane.email: jane@example.com
          s::john.age: 30
        `,
        description: 'Test 3: Multiple s:: in same level'
    },
    {
        content: `
        details:
          s::education.university: MIT
          work:
            s::role: Developer
        `,
        description: 'Test 4: Nested s:: with other keys'
    },
    {
        content: `
        s::location.country: Turkey
        `,
        description: 'Test 5: Only s:: without other keys'
    },
    {
        content: `
        animals:
          s::dogs.breed: Golden Retriever
          s::cats.color: White
        vehicles:
          s::cars.brand: Tesla
          s::planes.type: Commercial
        `,
        description: 'Test 6: Multiple top level keys with s:: patterns'
    },
    {
        content: `
        students:
          - name: John
            s::grade: A
          - name: Jane
            s::grade: B
        `,
        description: 'Test 7: Array with s:: pattern'
    },
    {
        content: `
        items:
          - s::product.name: Laptop
            s::product.price: 1000
          - s::product.name: Mobile
            s::product.price: 500
        `,
        description: 'Test 8: Array items using s:: pattern'
    },
    {
        content: `
        collections:
          - s::set.0: First
            s::set.1: Second
          - s::set.0: Third
        `,
        description: 'Test 9: Using array indices in s:: pattern'
    },
    {
        content: `
        s::array.0: First Element
        s::array.1: Second Element
        `,
        description: 'Test 10: Directly defining array elements with s::'
    },
    {
        content: `
        s::fruits.[0]: Apple
        s::fruits.[1]: Banana
        `,
        description: 'Test 11: Defining array items with s::[index] pattern'
    },
    {
        content: `
        s::people.[0].name: John
        s::people.[0].age: 30
        s::people.[1].name: Jane
        s::people.[1].age: 25
        `,
        description: 'Test 12: Defining nested objects within arrays using s::[index] pattern'
    },
    {
        content: `
        fruits:
          - Apple
          - Orange
        s::fruits.[2]: Banana
        `,
        description: 'Test 13: Adding an item to an existing array with s::[index] pattern'
    }
];