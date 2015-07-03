(function(global, factory) {
    'use strict';

    global.validator = factory(global.jQuery || global.Zepto || global.$);

})(this, function($) {
    'use strict';

    var defOptions = {
            // 存放待验证的字段
            fields: {},
            // 存放事件配置
            events: {},
            // 存放验证规则
            rules: {},
            // 表单DOM元素选择器
            formSelector: '',
            // 自动提交，默认为真
            autoSubmit: true
        };

    // 
    var V = function(options) {

        options = $.extend(defOptions, options);
        
        var $form = this.$form = $(options.formSelector);

        // 解析字段配置
        this.addField(options.fields);
        
        // // 解析验证规则
        // this.parseRules(options.rules, this);

        // 取消默认验证
        // $form.attr('novalidate', 'novalidate');

        // $form.on('submit', {context: this}, fireSubmit);

        // $form.on('change', otherSelector, this, handler);
        // $form.on('blur focus', textInputSelector, this, handler);

        // this.on(evNoValid, internalHandler(function(ev) {
        //     this.fields[ev.fieldName].noValid()
        // }))

    }

    $.extend(V.prototype, {

        // 存放字段配置
        fields: {},

        // 存放事件配置
        events: {},

        // 存放验证规则配置
        rules: {},

        // 统计验证失败的字段数量，作为表达验证成功与否的依据
        noValidCount: 0,

        // 收集异步验证规则返回的延迟对象，必须完成所有的延迟对象后才能提交
        deferred: [],
        
        // 添加验证字段
        addField: function(name, options) {
            var _options = {};
            
            if (typeof name === 'string') {
                _options[name] = options;            
            } else {
                _options = name;
            }

            for (name in _options) {
                _options[name].$form = this.$form;
                this.fields[name] = new Field(name, _options[name]);
            }
        },

        // 删除验证字段
        delField: function() {

        },

        // 解析验证规则
        parseRules: function() {

        },

        // 
        validate: function(fieldName, isSubmit) {
        },

        // 
        fireValidate: function () {
            var fieldName, fields = this.fields;
            // 每一轮验证开始前都要重置noValid
            this.noValidCount = 0;
            // 每一轮验证开始前都要重置deferred
            this.deferred = [];
            // 验证所有字段
            for (fieldName in fields) {
                this.validate(fieldName);
            }
        }
    });

    function fireSubmit(ev) {
        var context = ev.data.context;

        context.fireValidate();

        $.when.apply(null, context.deferred).then(
            function() {
                if (context.noValidCount === 0) {
                    // 触发表单
                    context.trigger(evSubmit);
                    // 提交表单
                    if (context.autoSubmit) {
                        context.$form[0].submit();
                    } 
                }
            },
            function() {
                // 触发表单验证失败事件
                context.trigger(evNoValid, 'form');
            }
        );

        return false;
    }


    //
    var Field = function(name, options) {

        this.$form = options.$form;
        this.$node = $('[name='+ name +']', options.$form);
        this.nodeType = getNodeType(this.$node);

        this.parseRule(options.rules);

        forEach('checkEmpty message messageTo isDisable required serverCallback'.split(' '), function(k, name) {
            this[name] = options[name];
        }, this);

    };    

    $.extend(Field.prototype, {
        // 字段DOM对象
        $node: null,
        // 字段类型
        elType: '',
        // 验证规则
        rules: [],
        // 字段名
        fieldName: '',
        // 非提交为空时是否检测
        checkEmpty: false,
        // 错误信息
        message: '',
        // 错误信息显示位置
        messageTo: '',
        // 验证结果，默认为true
        isValid: true,
        // 是否取消验证
        isDisable: false,
        // 是否必须
        required: true,

        validate: function() {
            var _this = this, 
                deferred = [],
                val = this.$el.val();

            forEach(this.rules, function(k, rule) {

                var handler = rule.handler, ret;

                if (typeof handler === 'string') {
                    ret = this[handler](rule.option, val);
                } else {
                    ret = handler.call(this, val);
                }

                if (ret === false) {
                    this.validateError();
                    return false;
                } 

                if (isDeferred(ret)) {
                    deferred.push(ret);   

                    $.when(ret).fail(function() {
                        _this.validateError();

                    }).done(function(resp) {
                        if (!_this.serverCallback(resp)) {
                            _this.validateError();
                        }
                    });
                }

            }, this);

            $.when.apply(null, deferred).done(function() {
                if (_this.isValid === true) {
                    _this.validateSuccess();
                }
            });

            return deferred;
        },

        validateError: function() {
            this.isValid = false;
        },

        validateSuccess: function() {
            this.isValid = true;
        },

        serverCallback: function() {
            return true;
        },

        parseRule: function(options) {
            
            if (!$.isArray(options)) {
                options = [options];
            }

            forEach(options, function(k, obj) {
            
                var t = $.type(obj), ret = {};

                // 正则
                if (t === 'regexp') {
                    ret.handler = 'regexp';
                    ret.option = obj;

                // 自定义函数
                } else if (t === 'function') {
                    ret.handler = obj;
                    ret.option = '';

                } else if (t === 'string') {
                    // 比对
                    if (obj.indexOf('confirm') === 0) {
                        ret.handler = 'confirm';
                        ret.option = $(obj.split(' ')[1], this.$form);

                    // 异步服务器校验
                    } else if (obj.indexOf('server') === 0) {
                        ret.handler = 'server';
                        ret.option = obj.split(' ')[1];

                    } else {
                        ret.handler = 'equal';
                        ret.option = obj;    
                    } 

                } else {
                    ret.handler = 'equal';
                    ret.option = obj;
                }

                this.rules.push(ret);

            }, this); 

        }

    });

    // 通用验证方法
    $.extend(Field.prototype, {
        // 正则表达式校验
        regexp: function(option, val) {
            return option.test(val);
        },
        // 相等校验
        equal: function(option, val) {
            return option === val;
        },
        // 二次输入是否一致校验
        confirm: function(option, val) {
            return option.val() === val;
        },
        // 异步校验
        // 返回一个延迟对象
        server: function(val, option) {
            return $.ajax({

            });
        }
    });



    function isDeferred(obj) {
        return obj && typeof obj.promise === 'function';
    }

    function forEach(obj, callback, context) {
        if (context) {
            return $.each(obj, $.proxy(callback, context));
        } else {
            return $.each(obj, callback);
        }
    }

    function getNodeType($node) {
        var tagName = $node[0].tagName.toUpperCase();
        return tagName === 'INPUT' ? $node.attr('type') : tagName ;
    }

    return V;
});



















