import { registerAccessibility } from '../features/a11y/index.js';
import { registerShortcuts } from '../features/shortcuts/index.js';

export function registerQuality(app) {
  registerAccessibility(app);
  registerShortcuts(app);
}
