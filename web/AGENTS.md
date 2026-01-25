# Maestro
This project is a single page web app for managing and viewing soccer statistics.

# Technology
The technology stack is:
* Typescript
* Solidjs
* tailwindcss
* daisyUI (https://daisyui.com/)
* @tanstack/solid-query

## Guide
* Use DaisyUI components where possible. Only create one from scratch if there isn't support DaisyUI.
* Do not overuse comments in the code. limit comments to dense blocks of code that are hard to understand
* This codebase will outlive you. Don't take shortcuts. Write sufficiently robust code that can be maintained or extended by the next person.

## Patterns
- When adding local state, consider whether it should be part of the navigation, i.e. url state
  - tabs, filters, etc. can be part of the URL (useSearchParams())
- Use <Switch/> for conditionally rendering mutually exclusive states 
- Use suspense to isolate components that take longer to load data
- Reuse query options, not custom hooks: Export factory functions for the API query options functions.
