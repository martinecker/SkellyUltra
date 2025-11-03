#!/usr/bin/env python3
"""
Module Bundler for Skelly Ultra
Combines all ES6 modules into a single file that works with file:// protocol
"""

import re
from datetime import datetime
from pathlib import Path

def strip_module_syntax(code, is_first_module=False):
    """Remove ES6 import/export statements"""
    # Remove export statements (export, export const, export class, export function, etc.)
    code = re.sub(r'^export\s+', '', code, flags=re.MULTILINE)
    
    # Remove import statements (including multi-line destructured imports)
    # This handles both single-line and multi-line import statements
    code = re.sub(r'^import\s+.*?from\s+[\'"].*?[\'"];?', '', code, flags=re.MULTILINE | re.DOTALL)
    
    # Also remove simple imports like: import './file.js';
    code = re.sub(r'^import\s+[\'"].*?[\'"];?', '', code, flags=re.MULTILINE)
    
    # Remove duplicate $ helper function declarations (except in first module that defines it)
    if not is_first_module:
        # Remove the $ helper comment and declaration
        code = re.sub(
            r'/\*\*\s*\n\s*\*\s*Simple UI Helper\s*\n\s*\*/\s*\nconst \$ = \(selector\) => document\.querySelector\(selector\);',
            '// $ helper already defined above',
            code,
            flags=re.MULTILINE | re.DOTALL
        )
    
    # Remove empty lines that were left behind
    code = re.sub(r'\n\s*\n\s*\n', '\n\n', code)
    
    return code.strip()

def read_file(filepath):
    """Read a file and return its contents"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def main():
    print('🔧 Bundling ES6 modules...')
    
    # Define module files in dependency order
    modules = [
        ('js/constants.js', 'Constants and Configuration'),
        ('js/protocol.js', 'Protocol Utilities'),
        ('js/state-manager.js', 'State Manager'),
        ('js/ble-manager.js', 'BLE Manager'),
        ('js/file-manager.js', 'File Manager'),
        ('js/protocol-parser.js', 'Protocol Parser'),
        ('js/edit-modal.js', 'Edit Modal Manager'),
        ('app-modular.js', 'Main Application'),
    ]
    
    # Read and process each module
    bundled_code = []
    found_dollar_helper = False
    for filepath, description in modules:
        print(f'  📦 Processing {filepath}...')
        try:
            code = read_file(filepath)
            
            # Check if this module has the $ helper
            has_dollar_helper = 'const $ = (selector) => document.querySelector(selector);' in code
            
            # Only keep the first occurrence of $ helper
            is_first_dollar = has_dollar_helper and not found_dollar_helper
            if has_dollar_helper:
                found_dollar_helper = True
            
            stripped_code = strip_module_syntax(code, is_first_module=is_first_dollar)
            
            bundled_code.append(f'''
  // {'=' * 60}
  // {description} ({filepath})
  // {'=' * 60}
{stripped_code}
''')
        except FileNotFoundError:
            print(f'  ❌ Error: {filepath} not found!')
            return 1
    
    # Create the bundle with IIFE wrapper
    timestamp = datetime.now().isoformat()
    bundle = f'''/**
 * Skelly Ultra - Bundled Version
 * All modules combined into a single file for file:// protocol compatibility
 * 
 * Generated: {timestamp}
 * 
 * This is an automatically generated file.
 * To modify, edit the source modules in js/ and app-modular.js, 
 * then rebuild with: build-bundle.bat (or python3 bundle.py)
 * 
 * Source modules:
{chr(10).join(f' *   - {fp}' for fp, _ in modules)}
 */

(() => {{
  'use strict';
{''.join(bundled_code)}
}})();
'''
    
    # Write the bundled file
    output_file = 'app-bundled.js'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(bundle)
    
    # Get file size
    size_kb = Path(output_file).stat().st_size / 1024
    
    print(f'\n✅ Bundle created successfully!')
    print(f'   Output: {output_file}')
    print(f'   Size: {size_kb:.1f} KB')
    print(f'\n📝 To use the bundled version, update index.html:')
    print(f'   <script src="{output_file}"></script>')
    print(f'\n   (Remove the type="module" attribute)')
    
    return 0

if __name__ == '__main__':
    try:
        exit(main())
    except Exception as e:
        print(f'\n❌ Error: {e}')
        import traceback
        traceback.print_exc()
        exit(1)
