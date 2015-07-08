# validator
A simple and useful form validator.

### Quick Start
```javascript
var options = {
    // 验证器要做的就是触发各种事件，
    // 通过订阅这些事件执行业务逻辑
    events: {
        'error': function(options) {
            options.$node.css('border', '1px solid red');
            options.$node.next('.error').html(options.message);
        },
        'success': function(options) {
            options.$node.css('border', '1px solid #ccc');
            options.$node.next('.error').html('');
        }
    },
    // 配置需要进行验证的字段
    fields: {
        username: {
            rules: /\w{6, 18}/,
            message: '请输入6-18位由字母或数字'
        }
    },
    // 每个验证实例都对应一个form，
    // 一个页面中的多个form互不影响
    formSelector: '#register'
};

var instance = Validator(options);
```
### options.events
支持的事件：
`error` 验证失败
`success` 验证成功
`focus` 获得焦点时（只针对部分类型的INPUT）
`blur` 失去焦点时（只针对部分类型的INPUT）
`beforeSubmit` 验证成功后，准备提交时

监听字段：通过冒号连接一个字段名，给指定字段绑定事件
`error:fieldName`

事件回调函数的两种写法：
①
```
events: {
    'error': function() {}
}
```
②
```
events: {
    'error': 'error'
}

instance.extend({
    error: function() {}
});
```
事件回调函数的执行上下文为验证器实例


### options.fields
#### `rules` 验证规则，可以是用数组配置多个规则
支持的规则：
>- 正则表达式
```
username: {
    rules: /\w/
}
```
>- 自定义函数
```
username: {
    rules: function(val) { return !!val; }
}
```
>- 二次对比
```
confirmPassword: {
    rules: 'confirm [name=password]'
}
```
confirm 是固定标识符，后面的是选择器，指定对比谁的值
>- 异步服务器验证
```
username: {
    rules: 'server http://api.52dachu.com/demo.php'
}
```
server 是固定标识符，后面是接口地址

规则可以用数组指定多个
```
usename: {
    rules: [
        /\w/,
        function() {},
        'server http://api.52dachu.com/demo.php'
    ]
}
```

#### `message` 错误信息，当有多个验证规则时，可以使用数组为每个规则指定错误信息，位置是一一对应的
```
username: {
    rules: [
        /\d/,
        function(val) { return val > 5; }
    ],
    message: [
        '必须是数字',
        '必须大于5'
    ]
}
```

#### `checkEmpty` 值为空时是否验证

#### `required` 是否是必须的

#### `messageTo` 显示错误信息的节点

### options.autoSubmit
验证成功后是否自动提交，默认为`true`。当我们需要做异步提交时可设置为`false`。通过监听`beforeSubmit`执行异步提交。

### options.formSelector

### methods

`addField` 添加验证字段
```
// 用法一
instance.addField('username', {
    rules: /\w/,
    message: '呵呵'
});
// 用法二
instance.addField({
    username: {
        rules: /\w/,
        message: '呵呵'
    }
});
```

`delField` 删除验证字段
```
// 多个用空格隔开
instance.delField('username');
```

`disableField` 禁止验证字段
```
// 多个用空格隔开
instance.disableField('username');
```

`enableField` 恢复禁止的字段
```
// 多个用空格隔开
instance.enableField('username');
```

`fireValidate` 触发验证
```
instance.fireValidate('username');
```

`extend` 用于扩展

`getFormData` 获取字段的值
```
var value = instance.getFormData('username');
```
不指定字段获取所有已配置字段的值



