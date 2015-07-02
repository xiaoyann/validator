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

    function V(options) {

        options = $.extend(defOptions, options);
        
        var $form = this.$form = $(options.formSelector);

        // 解析字段配置
        this.addField(options.fields);
        
        // 解析验证规则
        this.parseRules(options.rules, this);

        // 取消默认验证
        $form.attr('novalidate', 'novalidate');

        $form.on('submit', {context: this}, fireSubmit);

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
        addField: function() {

        },

        // 删除验证字段
        delField: function() {

        },

        // 解析验证规则
        parseRules: function() {

        },

        // // 字段DOM对象
        // $el: null,
        // // 字段类型
        // elType: '',
        // // 验证规则
        // rules: [],
        // // 字段名
        // fieldName: '',
        // // 非提交为空时是否检测
        // checkEmpty: false,
        // // 错误信息
        // message: '',
        // // 错误信息显示位置
        // messageTo: '',
        // // 验证结果
        // isValid: true,
        // // 是否取消验证
        // isDisable: false,
        // // 是否必须
        // required: true

        // 
        validate: function(fieldName, isSubmit) {
            var conf = this.fields[fieldName], 
                value = $.trim(conf.$el.val()),
                rules = this.rules,
                deferred = [], 
                _this = this;

                // 跳过 disable 的字段
            if (conf.isDisable || 
                // 跳过值为空并且不是必须的字段
                (value === '' && (conf.required === false || (!isSubmit && !conf.checkEmpty))) ||
                // 跳过验证规则为空的
                conf.rules === '') {
                
                return;
            }

            // 跳过重复验证
            if (conf.isValid === false) { 
                this.noValidCount += 1;
                return;
            }

            $.each(conf.rules, function(k, ruleName) {
                var rule = rules[ruleName], ret, 
                // 监听标识
                target = fieldName+':'+ruleName,
                handler = rule.handler

                if (typeof handler === 'function') {
                    ret = handler(value, rule.option.message || field.message)
                } else if((handler = ruleHandlers[handler])) {
                    ret = handler(value, rule.option)
                } else {
                    ret = false
                }
                
                // 只要有一个验证返回false，就将该字段的isValid设置为false，并不再继续验证
                // 当延迟对象执行完后应该检测isValid，如果isValid为false，那么字段的验证结果
                // 就是false，无论延迟对象的结果是什么都不要再更新isValid。如果isValid是true，
                // 才需要将延迟对象的结果更新到isValid
                if (ret === false) {
                    // 触发单个规则验证失败事件
                    _this.trigger(evNoValid, target)
                    return false
                } else if (isDeferred(ret)) {
                    deferred.push(ret)   
                    // 验证对象失败时处理
                    $.when(ret).fail(function() {
                        // 触发单个规则验证失败事件
                        _this.trigger(evNoValid, target)
                    // 验证对象成功时处理   
                    }).done(function(resp) {
                        if ( _this.ajaxCallback(resp) ) {
                            // 触发单个规则验证成功事件
                            _this.trigger(evIsValid, target)   
                        } else {
                            // 触发单个规则验证失败事件
                            _this.trigger(evNoValid, target)    
                        }
                    })
                } else {
                    // 触发单个规则验证成功事件
                    _this.trigger(evIsValid, target)
                }
            })

            // 更据字段的isValid判断字段的验证结果，触发相应的事件
            // 前面已经对所有deferred的执行结果做了处理，并已更新给字段的isValid
            // 所以这里执行时只需要检测isValid来做相应的处理
            $.when.apply(null, deferred).done(function() {
                if (field.isValid === true) {
                    _this.trigger(evIsValid, fieldName)
                }
            });

            // 收集验证时产生的延迟对象
            this.deferred = this.deferred.concat(deferred);
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
        },

        // 
        ajaxCallback: function() {

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



    return V;
});



















