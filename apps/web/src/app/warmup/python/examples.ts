export type Example = {
  id: string; title: string; description: string; topic: string; filename: string;
  code: string[]; choices: string[]; answer: string; prompt: string; explanationPrompt: string;
  result: string; reasoning: string; traceHeading: string; columns: [string, string, string];
  trace: { value: string; condition: string; total: string; line: number; detail: string }[];
};

export const runningTotal: Example = {
  id: "running-total", title: "Follow the running total", description: "Which values make it into the sum?", topic: "Loops & conditions", filename: "running_total.py",
  code: ["values = [3, 1, 4]", "total = 0", "for value in values:", "    if value > 1:", "        total += value", "print(total)"],
  choices: ["5", "7", "8"], answer: "7", prompt: "The loop visits all three values. Which ones change the total?",
  traceHeading: "Follow each pass.", columns: ["value", "condition", "total"],
  explanationPrompt: "Why does the total stay unchanged when value is 1?",
  result: "Only 3 and 4 pass the condition. The value 1 is skipped.",
  reasoning: "1 > 1 is false. The addition on line 5 runs only for values strictly greater than 1. Changing the condition to >= 1 would include all three values and print 8.",
  trace: [
    { value: "—", condition: "Not checked", total: "0", line: 2, detail: "Start with total = 0, before the loop." },
    { value: "3", condition: "3 > 1 → True", total: "3", line: 5, detail: "The first value passes the condition. Add 3 to the total." },
    { value: "1", condition: "1 > 1 → False", total: "3", line: 4, detail: "The condition is strictly greater than 1. Skip this value; total stays 3." },
    { value: "4", condition: "4 > 1 → True", total: "7", line: 5, detail: "Add 4. The loop finishes with total = 7, so line 6 prints 7." },
  ],
};

export const listReferences: Example = {
  id: "list-references", title: "Two names, one list", description: "Does assigning a list make a copy?", topic: "References & mutation", filename: "list_references.py",
  code: ["items = [1, 2]", "other = items", "other.append(3)", "other = [9]", "print(items)"],
  choices: ["[1, 2]", "[1, 2, 3]", "[9]"], answer: "[1, 2, 3]", prompt: "Track the list objects, not just the variable names. What does print(items) show?",
  traceHeading: "Follow the references.", columns: ["line", "other", "items"],
  explanationPrompt: "Why does append change items, while assigning [9] to other does not?",
  result: "The append changes the shared list. Reassigning other later leaves items pointing to that original list.",
  reasoning: "other = items binds a second name to the same list; it does not copy the list. append(3) mutates that shared object. other = [9] then binds only other to a new list. items still refers to [1, 2, 3].",
  trace: [
    { value: "1", condition: "Not assigned", total: "[1, 2]", line: 1, detail: "Create a list containing 1 and 2, and bind items to it." },
    { value: "2", condition: "Same list", total: "[1, 2]", line: 2, detail: "other and items now refer to the same list. No copy is made." },
    { value: "3", condition: "Same list", total: "[1, 2, 3]", line: 3, detail: "Appending through other mutates the shared list. items sees the added 3 too." },
    { value: "4", condition: "New list [9]", total: "[1, 2, 3]", line: 4, detail: "Rebind other to a new list. items still refers to the original list, so line 5 prints [1, 2, 3]." },
  ],
};
