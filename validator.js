/**
 * Feature:
 *   1. 验证选项支持随时添加或删除
 *   2. 支持一个字段多个验证规则，支持设置不同的错误信息
 *   3. 支持手动触发验证
 *   4. 支持设置提交方式
 *   5. 支持监听字段验证的成功或失败 支持监听字段某个规则验证的成功或失败
 *   6. 支持临时禁止某个字段的验证，而后可以再次激活
 *   7. 能获取form所有或单个数据
 * Date: 2014年12月11日15:16:27
 * Author: striverx@163.com
 */

(function(window, factory) {
    'use strict';
    if (typeof require == 'function' && module && typeof module.exports == 'object') {
        module.exports = factory(require('jquery'))
    } else {
        window.validator = factory($)
    }
})(window, function($) {
    'use strict';

    var Validator, Field, properties, PubSub, ruleHandlers,

    // 定义自定义事件名 便于统一管理
    // 验证成功
    evIsValid = 'isValid',
    // 验证失败
    evNoValid = 'noValid',
    // 获得焦点
    evFocusin = 'focus',
    // 失去焦点
    evFocusout = 'blur',
    // 重置字段
    evResetField = 'resetField',

    // 文本输入框选择器
    textInputSelector = 'input[type!=radio][type!=checkbox][type!=submit][type!=button]',
    // checkbox radio select
    otherSelector = 'input[type=radio],input[type=checkbox],select',

    // 内置规则
    defaultRules = {
        required: [function(val) {
            return $.trim(val) !== ''
        }, '不能为空']
    }

    Validator = function(options) {
        // 验证失败的字段数量
        this.noValid = 0
        // 异步验证规则返回的延迟对象 在form submit时，需要检测所有的deferred对象是否执行完成后才能提交
        this.deferred = []
        // topics 用于实现自定义事件处理
        this.topics = new PubSub()
        // 需要验证的字段
        this.fields = {}
        
        // 获取表单对象
        var $form = this.$form = $(options.form)
        // 获取所有字段对象
        this.addField(options.fields)
        // 默认自动提交
        this.autoSubmit = 'autoSubmit' in options ? !!options.autoSubmit : true
        // parse rules
        this.rules = parseRules($.extend({}, defaultRules, options.rules || {}))
        // 指定异步回调，该回调必须返回true或fase
        if (typeof options.ajaxCallback == 'function') {
            (ajaxCallback = options.ajaxCallback)
        }
        
        // 取消默认验证
        $form.attr('novalidate', 'novalidate')
        // 事件绑定
        $form.on('submit', $.proxy(submit, this))
        $form.on('change', otherSelector, $.proxy(handler, this))
        $form.on('blur focus', textInputSelector, $.proxy(handler, this))
    }

    Validator.prototype = {
        // reset constructor 
        constructor: Validator,

        // 通过fieldName获取相应的配置
        validate: function(fieldName, isSubmit) {
            var field = this.fields[fieldName], 
            value = $.trim(field.$el.val()), rules = this.rules,
            deferred = [], _this = this
            // 跳过pause过的字段 
            // 跳过值为空并且不是必须的字段
            // 跳过验证规则为空的
            if (field.isDisable || (value === '' && (field.required === false || (!isSubmit && !field.checkEmpty))) || field.rules === '') {
                return
            }
            // 跳过重复验证
            if (field.isValid === false) { 
                this.noValid++
                return
            }
            $.each(field.rules, function(k, ruleName) {
                var rule = rules[ruleName], ret, 
                // 监听标识
                target = fieldName+':'+ruleName,
                handler = rule.handler

                if (typeof handler == 'function') {
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
                _this.trigger(field.isValid ? evIsValid : evNoValid , fieldName)
            })

            // 每一轮验证都要重置deferred 
            this.deferred = this.deferred.concat(deferred)
        },

        // 监听的事件有：
        // 1. 字段获取焦点   
        // 2. 字段失去焦点
        // 3. 字段验证成功
        // 4. 字段验证失败
        // 5. 单个规则验证成功
        // 6. 单个规则验证失败
        // 7. 表单验证成功
        // 8. 表单验证失败
        on: function(ev, target, handler) {
            this.topics.subscribe(buildTopicName(ev, target), handler)
        },

        // 所有使用on监听的事件都可以手动触发
        trigger: function(ev, target) {
            var topics = this.topics,
            targets = target.split(':'), 
            i, l = targets.length-1, temp = '', $el

            if ( targets[0] in this.fields ) {
                $el = this.fields[targets[0]].$el
            }

            topics.publish(buildTopicName(ev, target), $el)
            topics.publish(buildTopicName(ev, '**'), $el)

            for ( i = 0; i < l; i++ ) {
                temp = temp.replace('**', '') 
                temp += targets[i] + ':**'
                topics.publish(buildTopicName(ev, temp), $el)
            }
        },

        // 添加验证字段
        addField: function(options) {
            var fields = $.isArray(options) ? options : $.isPlainObject(options) ? [options] : [],
            i, $el, tagName, item, fieldName, _this = this,
            // update noValid
            updateNoValid = $.proxy(function() {
                this.noValid++
            }, this)

            for ( i = 0; (item = fields[i]) !== undefined; i++ ) {
                fieldName = item.name
                $el = $('[name='+fieldName+']', this.$form)
                tagName = $el[0].tagName.toLowerCase()
                item.elType = tagName == 'INPUT' ? $el.attr('type') : tagName
                
                this.fields[fieldName] = new Field({
                    '$el': $el,
                    'elType': item.elType,
                    'rules': $.trim(('required' in item && !item.required ? '' : 'required ') + item.rules).split(' '),
                    'checkEmpty': !!item.checkEmpty,
                    'message': item.message,
                    'messageTo': item.messageTo,
                    'fieldName': fieldName,
                    'required': item.required
                })

                // 只要有一个规则验证失败就触发字段验证失败事件
                this.on(evNoValid, fieldName + ':**', $.proxy(this.fields[fieldName], 'noValid'))

                // 监听字段验证失败 更新noValid
                this.on(evNoValid, fieldName, updateNoValid)
            }
        },

        // 删除验证字段
        delField: function(fieldName) {
            var fields = this.fields, i, l
            fieldName = fieldName.split(' ')
            for ( i = 0, l = fieldName.length; i < l; i++ ) {
                delete fields[fieldName[i]]
            }
        },

        // 重置字段
        resetField: function(fieldName) {
            var field = this.fields[fieldName]
            field.isValid = true
            this.trigger(evResetField, fieldName)
        },

        // pause
        disableField: function(fieldName) {
            this.toggleDisable(fieldName, true)
        },

        // resume
        enableField: function(fieldName) {
            this.toggleDisable(fieldName, false)
        },

        toggleDisable: function(fieldName, value) {
            var fields = this.fields, i, fname
            fieldName = fieldName.split(' ')
            for (i = 0; (fname = fieldName[i]) !== undefined; i++) {
                if (fname in fields) {
                    fields[fname].isDisable = value
                }
            }
        },

        // 
        getFormData: function() {
        }
    }

    ruleHandlers = {
        // 正则表达式校验
        handlerRegExp: function(val, option) {
            return option.pattern.test(val)
        },
        // 相等校验
        handlerEqual: function(val, option) {
            return option.pattern === val
        },
        // 二次输入是否一致校验
        handlerConfirm: function(val, option) {
            return option.$confirm.val() === val
        },
        // 异步校验
        // 返回一个延迟对象
        handlerAsync: function(val, option) {
            return $.ajax({

            })
        }
    }


    // Field 属性设置
    properties =  {   
        // 字段DOM对象
        $el: null,
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
        // 验证结果
        isValid: true,
        // 是否暂停验证
        isDisable: false,
        // 是否必须
        required: true
    }    

    // 
    Field = function(options) {
        for ( var proName in properties ) {
            this[proName] = proName in options ? options[proName] : properties[proName]
        }
    }
    Field.prototype.noValid = function() {
        // 每一轮验证，字段验证失败事件只触发一次
        if (this.isValid === true ) {
            this.isValid = false
        }
    }

    // 发布/订阅 用于方便实现自定义事件
    PubSub = function () {
        this.topics = {}
    }
    PubSub.prototype.subscribe = function(topic, handler) {
        var handlers = this.topics[topic] || []
        if ( typeof handler == 'function' ) {
            handlers.push(handler)
        } else {
            handlers = handlers.concat(handler)
        }
        this.topics[topic] = handlers
    }
    PubSub.prototype.publish = function(topic) {
        var handlers = this.topics[topic] || [],
        args = [].slice.call(arguments, 1),
        i, l = handlers.length, ret
        if ( l > 0 ) {
            for ( i = 0; i < l; i++ ) {
                ret = handlers[i].apply(null, args)
            }
        }
        return ret
    }

    var handler = function (ev) {
        var fieldName = $(ev.target).attr('name')
        if (fieldName in this.fields) {
            switch(ev.type) {
                case 'focusin': 
                    // 触发focus
                    this.trigger(evFocusin, fieldName)
                    // 重置字段
                    this.resetField(fieldName)
                break;
                case 'focusout':
                    // 触发blur
                    this.trigger(evFocusout, fieldName)
                    // 执行验证
                    this.validate(fieldName)
                    break;
                case 'change':
                    // 执行验证
                    this.validate(fieldName)
                break;
            }
        }
    }

    var submit = function () {
        var fieldName, fields = this.fields, _this = this
        
        // 每一轮验证开始前都要重置noValid
        this.noValid = 0
        // 每一轮验证开始前都要重置deferred
        this.deferred = []

        // 验证所有字段
        for ( fieldName in fields ) {
            this.validate(fieldName, true)
        }

        $.when.apply(null, this.deferred).then(
            function() {
                if ( _this.noValid === 0 ) {
                    // 触发表单验证成功事件
                    _this.trigger(evIsValid, 'form')
                    // 提交表单
                    if (_this.autoSubmit) {
                        _this.$form[0].submit()    
                    } 
                }
            },
            function() {
                // 触发表单验证失败事件
                _this.trigger(evNoValid, 'form')
            }
        )

        return false
    }

    var updateNoValid = function () {
        this.noValid++
    }

    function buildTopicName() {
        return [].join.call(arguments, ':')
    }

    var parseRules = function (rules) {
        var ruleName, ruleOption, ruleType, handler, ruleConfig, ret = {}

        for ( ruleName in rules ) {
            ruleConfig = {}
            ruleOption = rules[ruleName]
            // 转成数组方便统一处理
            if (!$.isArray(ruleOption)) {
                ruleOption = [ruleOption]
            }
            ruleType = $.type(ruleOption[0])
            // 自定义函数 必须返回boolean值 或使用jQuery得到的deferred对象
            if (ruleType == 'function') {
                handler = ruleOption[0]
            // 正则 使用内部定义好的函数
            } else if (ruleType == 'regexp') {
                handler = 'handlerRegExp'
                ruleConfig.pattern = ruleOption[0]
            // confirm
            } else if (ruleOption[0] == 'confirm') {
                handler = 'handlerConfirm'
                ruleConfig.$confirm = $('[name='+ruleOption[1]+']', this.$form)
            // async    
            } else if (ruleOption[0] == 'async') {
                handler = 'handlerAsync'
                ruleConfig.url = ruleOption[1]
                ruleConfig.dataName = ruleOption[2] || 'data'
            // 其他的 直接使用内容定义好的函数 判断是否相等    
            }else {
                handler = 'handlerEqual'
                ruleConfig.pattern = ruleOption[0]
            }
            // 最后一个参数才是message
            ruleConfig.message = ruleOption[ruleOption.length - 1]
            
            ret[ruleName] = {
                handler: handler,
                option: ruleConfig
            }
        }
        return ret
    }

    function ajaxCallback( resp ) {
        return !!resp
    }

    // 是否是延迟对象
    function isDeferred(obj) {
        return obj && typeof obj.promise == 'function'
    }

    return function(options) {
        return new Validator(options)
    }

})


//  model  controller view
















