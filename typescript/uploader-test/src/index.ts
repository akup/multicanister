var x   = 1;

//export { x };

// Function with return type annotation
function add(a: number, b: number): number {
  return a + b;
}

// Using the variable
const result: number = add(1, 2);

// Using a properly typed variable
const message: string = 'Hello, World!';

// Unused variable
const unused = 'test';

// Any type usage
const something: any = 'test';

export { add, result, message };
