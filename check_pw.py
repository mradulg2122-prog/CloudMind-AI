import re
PW_REGEX = re.compile(r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\'\"\\|,.<>\/?]).{8,}$')
test_pws = ['TestPass!2024A', 'AdminPass!2024B', 'SecureP@ss1A', 'TestPass123!', 'SecurePass!2024', 'Adm!n_Secure99']
for p in test_pws:
    m = bool(PW_REGEX.match(p))
    print(f'{p!r:35s} => {m}')
