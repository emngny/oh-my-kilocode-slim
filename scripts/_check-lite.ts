import { generateLiteConfig } from './src/cli/providers.ts';

const out = generateLiteConfig({
  hasTmux: false,
  installCustomSkills: false,
  reset: false,
});

console.log('Has delegationMode:', 'delegationMode' in out);
console.log('delegationMode value:', out.delegationMode);
console.log('Full output:');
console.log(JSON.stringify(out, null, 2));
