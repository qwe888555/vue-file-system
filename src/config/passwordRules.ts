// ── 密码校验规则（对齐后端 Django validators） ──

/** 常见弱密码（后端 CommonPasswordValidator 名单的子集） */
const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', '1234567890',
  'qwerty123', 'abc12345', '11111111', '00000000',
  'admin123', 'admin888', 'iloveyou', 'sunshine',
  'welcome1', 'password1', 'password123', 'passw0rd',
])

/** 非必填场景的密码规则（编辑「修改密码」用） */
export const passwordRules = [
  { min: 8, message: '密码长度至少 8 位', trigger: 'blur' },
  {
    validator: (_rule: any, value: string, callback: Function) => {
      if (!value) { callback(); return }
      if (/^\d+$/.test(value)) {
        callback(new Error('密码不能全是数字'))
      } else if (COMMON_PASSWORDS.has(value.toLowerCase())) {
        callback(new Error('密码过于常见，请更换'))
      } else {
        callback()
      }
    },
    trigger: 'blur',
  },
]

/** 必填场景的密码规则（新增/批量修改用） */
export const passwordRulesRequired = [
  { required: true, message: '请输入密码', trigger: 'blur' },
  ...passwordRules,
]
