// Test data for the s:: processor
export default [
    {
        // Basic key-value assignments at the root level
        content: `
        name: About a demo
        description: This is a demo
        s::metadata.author.name: fnet
        metadata:
          createdOn: 2020-01-01
          createdBy: fnet
          s::author.email: xyzt@gmail.com
        `,
        description: 'Test 1: Root Level Key-Value Assignment'
    },
    {
        // Nested assignments within existing structure
        content: `
        s::topLevel: some value
        nested:
          s::deeply.nested.value: A deeply nested value
        `,
        description: 'Test 2: Nested Key-Value Assignment'
    },
    {
        // Multiple s:: assignments on the same level
        content: `
        friends:
          s::jane.email: jane@example.com
          s::john.age: 30
        `,
        description: 'Test 3: Multiple Assignments on Same Level'
    },
    {
        // Nested s:: assignments mixed with regular keys
        content: `
        details:
          s::education.university: MIT
          work:
            s::role: Developer
        `,
        description: 'Test 4: Mixed Nested Assignment with Regular Keys'
    },
    {
        // Only s:: assignments without any regular keys
        content: `
        s::location.country: Turkey
        `,
        description: 'Test 5: Exclusive s:: Assignment'
    },
    {
        // Multiple top-level keys with nested s:: patterns
        content: `
        animals:
          s::dogs.breed: Golden Retriever
          s::cats.color: White
        vehicles:
          s::cars.brand: Tesla
          s::planes.type: Commercial
        `,
        description: 'Test 6: Multiple Top-Level Keys with Nested s::'
    },
    {
        // Using s:: within array items
        content: `
        students:
          - name: John
            s::grade: A
          - name: Jane
            s::grade: B
        `,
        description: 'Test 7: s:: Within Array Items'
    },
    {
        // Defining entire array items with s:: patterns
        content: `
        items:
          - s::product.name: Laptop
            s::product.price: 1000
          - s::product.name: Mobile
            s::product.price: 500
        `,
        description: 'Test 8: Complete Array Items with s::'
    },
    {
        // Using array indices with s:: patterns
        content: `
        collections:
          - s::set.0: First
            s::set.1: Second
          - s::set.0: Third
        `,
        description: 'Test 9: Using Array Indices with s::'
    },
    {
        // Directly defining array elements using s:: pattern
        content: `
        s::array.0: First Element
        s::array.1: Second Element
        `,
        description: 'Test 10: Direct Array Items Definition with s::'
    },
    {
        // Using bracket notation for array indices
        content: `
        s::fruits.[0]: Apple
        s::fruits.[1]: Banana
        `,
        description: 'Test 11: Bracket Notation for Array Indices with s::'
    },
    {
        // Defining objects within arrays using bracket notation
        content: `
        s::people.[0].name: John
        s::people.[0].age: 30
        s::people.[1].name: Jane
        s::people.[1].age: 25
        `,
        description: 'Test 12: Nested Object Assignment in Arrays using Bracket Notation'
    },
    {
        // Adding to an existing array using bracket notation
        content: `
        fruits:
          - Apple
          - Orange
        s::fruits.[2]: Banana
        `,
        description: 'Test 13: Append to Existing Array using Bracket Notation'
    }
];