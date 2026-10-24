import json

with open('database.rules.json', 'r', encoding='utf-8') as f:
    rules = json.load(f)

rules['rules']['courses'] = {
    '.read': True,
    '.write': 'auth != null && auth.token.admin === true'
}
rules['rules']['packages'] = {
    '.read': True,
    '.write': 'auth != null && auth.token.admin === true'
}
rules['rules']['packages_private'] = {
    '.read': False,
    '.write': 'auth != null && auth.token.admin === true'
}
rules['rules']['attempts'] = {
    '$uid': {
        '.read': 'auth != null && (auth.uid === $uid || auth.token.admin === true)',
        '.write': 'auth != null && auth.token.admin === true',
        '$attemptId': {
            '.read': 'auth != null && (auth.uid === $uid || auth.token.admin === true)',
            '.write': 'auth != null && auth.token.admin === true'
        }
    }
}

with open('database.rules.json', 'w', encoding='utf-8') as f:
    json.dump(rules, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('Rules updated successfully with correct keys.')
