#!/usr/bin/env python3
# Fix encoding issues in the GigTax HTML file

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the common mojibake sequences - these are UTF-8 double-encoded or corrupted
# Based on hexdump analysis: c3 a2 e2 82 ac e2 80 9d = â€" (mojibake for em-dash)

# Fix em-dash mojibake (â€" or â€" )
content = content.replace('â€" ', '— ')
content = content.replace('â€"', '—')
content = content.replace('â€" ', '— ')
content = content.replace('â€"­', '—')  # with ZWNJ

# Fix en-dash 
content = content.replace('â€" ', '– ')
content = content.replace('â€"', '–')

# Fix bullet point (â€¢)
content = content.replace('â€¢', '•')

# Fix checkmark variants
content = content.replace('âœ" ', '✓ ')
content = content.replace('âœ"', '✓')
content = content.replace('âœ“', '✓')
content = content.replace('âœ" ', '✓ ')
content = content.replace('âœ\x94', '✓')
content = content.replace('âœ\x93', '✓')

# Fix warning/alert
content = content.replace('âš" ', '⚠ ')
content = content.replace('âš"', '⚠')
content = content.replace('âš ï¸', '⚠️')
content = content.replace('âš ', '⚠ ')
content = content.replace('âš ', '⚠')

# Fix multiplication sign
content = content.replace('Ã—', '×')

# Fix 1/2 fraction
content = content.replace('Â½', '½')

# Now fix the emoji sequences - these start with ð followed by special chars
# Income: 💰 
content = content.replace('ðŸµ', '💰')
content = content.replace('ðŸ""', '💰')
content = content.replace('ðŸ”š', '💰')

# Expenses: 📝
content = content.replace('ðŸ" ', '📝')
content = content.replace('ðŸ"\x8d', '📝')
content = content.replace('ðŸ"', '📝')

# Mileage: 🚗
content = content.replace('ðŸš—', '🚗')

# Find $ / Deductions: 💡
content = content.replace('ðŸ¡', '💡')

# Estimate: 📊
content = content.replace('ðŸ"Š', '📊')
content = content.replace('ðŸŠ', '📊')

# Export: 📤
content = content.replace('ðŸ"¤', '📤')
content = content.replace('ðŸ"', '📤')

# Lock: 🔒
content = content.replace("ðŸ\"'", '🔒')

# Reset/Clipboard: 📋
content = content.replace('ðŸ—ï¸', '📋')
content = content.replace('ðŸ—\xa0', '📋')
content = content.replace('ðŸ—', '📋')

# Phone: 📱
content = content.replace('ðŸ"±', '📱')

# Software: 💻
content = content.replace('ðŸ»', '💻')
content = content.replace('ðŸ' + '»', '💻')

# Supplies: 🧱
content = content.replace('ðŸ§¹', '🧱')

# Insurance: 🛡️
content = content.replace('ðŸ›¡ï¸', '🛡️')
content = content.replace('ðŸ›', '🛡')

# Platform fees / money: 💰
content = content.replace('ðŸ°', '💰')

# Health insurance: 📊
content = content.replace('ðŸŠ', '📊')

# Copy to clipboard: 📋
content = content.replace('ðŸ"‹', '📋')

# Download: 📥
content = content.replace('ðŸ"¥', '📥')

# Calendar: 📅
content = content.replace('ðŸ"œ', '📅')

# Box / shipping: 📦
content = content.replace('ðŸ" ', '📦')

# Factory / COGS: 🏭
content = content.replace('ðŸ"·ï¸', '🏭')
content = content.replace('ðŸ"·', '🏭')

# Advertising: 📣
content = content.replace('ðŸ"£', '📣')

# Equipment: 🔧
content = content.replace('ðŸ"§', '🔧')

# Home office / Building: 🏢
content = content.replace('ðŸ"¦', '🏢')

# More specific patterns
content = content.replace('ðŸ' + '›¡ï¸', '🛡️')
content = content.replace('ðŸ›¡ï', '🛡')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Encoding fixes applied - fix_encoding.py:129')
