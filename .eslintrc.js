module.exports = {
    root: true,
    extends: [
        'eslint:recommended',
        // Uses the recommended rules from @eslint-plugin-react
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        // eslint-config-prettier 关闭与 prettier 冲突的格式规则，必须放在最后。
        // 格式化交给 `npm run format`（prettier）自己跑，不再用 eslint-plugin-prettier
        // 把格式问题也报成 lint 错误。
        'prettier',
    ],
    // 这里只能写插件名。原配置把 'plugin:vue/essential'、'eslint:recommended' 这类
    // extends 配置名塞进了 plugins，会导致 eslint 加载插件直接失败。
    env: {
        browser: true,
        node: true,
        es6: true,
    },
    settings: {
        // Tells eslint-plugin-react to automatically detect the version of React to use
        react: {
            version: 'detect',
        },
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true,
        },
    },
    globals: {
        __dirname: false,
        require: false,
        document: false,
        window: false,
        console: false,
        module: false,
        R: false,
        moment: false,
    },
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
        // 使用 let,const 代替 var
        // 'no-var': 'error',
        // 对所有的引用使用 const ；不要使用 var
        'prefer-const': 'error',
        'no-const-assign': 'error',
        // 避免使用单字母名称。使你的命名具有描述性
        'id-length': 'off',
        // 当命名对象，函数和实例时使用驼峰式命名
        camelcase: 'off',
        // 要求箭头函数的参数使用圆括号
        'arrow-parens': 0,
        // 使用字面量语法创建对象
        'no-new-object': 'error',
        // 使用对象方法速记语法
        'object-shorthand': 'error',
        // 只用引号引无效标识符的属性
        'quote-props': ['error', 'as-needed'],
        // 使用字面量创建数组
        'no-array-constructor': 'error',
        // 当访问和使用对象的多个属性时，请使用对象解构
        'prefer-destructuring': ['error', { object: true, array: false }],
        // 字符串使用单引号 '', 暂时不用，因为vscode默认是双引
        quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
        // 以编程方式构建字符串时，请使用模板字符串而不是字符串连接
        'prefer-template': 'error',
        // 不要eval
        'no-eval': 'error',
        // 用圆括号包裹立即调用函数表达式 (IIFE)
        'wrap-iife': ['error', 'outside'],
        // 不要改变参数
        'no-param-reassign': 'error',
        // 当必须使用匿名函数（如在传递一个内联回调时），请使用箭头函数表示法
        'prefer-arrow-callback': 'error',
        // 如果没有指定，类有一个默认的构造函数。一个空的构造函数或者只是委托给父类则不是必须的。
        'no-useless-constructor': 'off',
        // 避免重复类成员
        'no-dupe-class-members': 'error',
        // 变量不要链式赋值
        'no-multi-assign': 'error',
        // 在 case 和 default 子句中，使用大括号来创建包含词法声明的语句块(例如 let, const, function, 和 class).
        'no-case-declarations': 'error',
        // 三元表达式不应该嵌套，通常写成单行表达式。
        'no-nested-ternary': 'off',
        // 当运算符混合在一个语句中时，请将其放在括号内。混合算术运算符时，不要将 * 和 % 与 + ， -，，/ 混合在一起。
        'no-mixed-operators': 'error',
        // 使用大括号包裹所有的多行代码块
        'nonblock-statement-body-position': ['error', 'below'],
        // 如果通过 if 和 else 使用多行代码块，把 else 放在 if 代码块闭合括号的同一行
        'brace-style': 'error',
        // 如果一个 if 块总是执行一个 return 语句，后面的 else 块是不必要的。在 else if 块中的 return，可以分成多个 if 块来 return
        'no-else-return': 'error',
        // 所有注释符和注释内容用一个空格隔开，让它更容易阅读
        'spaced-comment': ['error', 'always'],
        // 使用空格把运算符隔开
        'space-infix-ops': 'error',
        // 在文件末尾插入一个空行。
        'eol-last': 'error',
        // 长方法链式调用时使用缩进（2个以上的方法链式调用）。使用一个点 . 开头，强调该行是一个方法调用，不是一个新的声明。
        'newline-per-chained-call': 'off',
        //  不要在中括号内添加空格。
        'array-bracket-spacing': ['error', 'never'],
        'object-curly-spacing': ['error', 'always'],
        // 在声明语句的开始处就执行强制类型转换.
        'no-new-wrappers': 'error',
        // 函数的箭头之前或之后有空格
        'arrow-spacing': 2,
        // 对象字面量中冒号的后面必须有空格，前面不允许有空格
        'key-spacing': [
            2,
            {
                beforeColon: false,
                afterColon: true,
            },
        ],
        // 关键字前后必须存在空格
        'keyword-spacing': [
            2,
            {
                before: true,
                after: true,
            },
        ],
        // 构造函数首字母大写
        'new-cap': [2, { newIsCap: true, capIsNew: false }],
        // 在写逗号时，逗号前面不需要加空格，而逗号后面需要添加空格
        'comma-spacing': [2, { before: false, after: true }],
        // allow async-await
        'generator-star-spacing': 0,
        // allow debugger during development
        //   'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 1,
        'no-console': 'off',
        // 函数定义的时候不允许出现重复的参数
        'no-dupe-args': 2,
        // 必须使用 === 或 !==，禁止使用 == 或 !=，与 null 比较时除外
        // eqeqeq: [2, 'always', { null: 'ignore' }],

        'space-before-blocks': [1, 'always'],

        // 限制函数的最大参数个数,
        'max-params': [2, 8],

        'max-len': ['off', 200],

        // getter 必须有返回值，并且禁止返回空，比如 return;
        'getter-return': ['error', { allowImplicit: false }],
        'no-empty-function': 'off',

        'no-use-before-define': 'off',
        // 未使用的变量按 warning 提示，未使用的函数参数不报
        'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
        'prefer-destructuring': 'off',
        'no-case-declarations': 'off',
        'no-mixed-operators': 'off',
    },
    overrides: [
        {
            // Vue 侧文件不适用 React 规则：JSX 由 @vue/babel-plugin-jsx 编译成 createVNode，
            // 不存在 React 命名空间，也没有 Hooks 规则约束；
            // vue-adapter 还是 tab 缩进的历史风格，不套用本仓库的缩进规则。
            files: ['src/vue/**/*.js', 'src/vue/**/*.jsx'],
            rules: {
                indent: 'off',
                'react/react-in-jsx-scope': 'off',
                'react/prop-types': 'off',
                'react/display-name': 'off',
                'react-hooks/rules-of-hooks': 'off',
                'react-hooks/exhaustive-deps': 'off',
            },
        },
    ],
}
