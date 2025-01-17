---
title: "WAF 源码分析"
date: "2021-11-06T13:40:00+08:00"
typeface: sans
toc: true
draft: true
---

> 源码分析主要针对规则引擎部分进行解析，以更好地理解 WAF 规则的加载和执行过程，平台设计时能够有更丰富的思考。未阅读的源码部分还包含 Perl 脚本对 ModSecurity 规则转换和 Test::Nginx 单元测试部分。

## 1. 规则引擎

应用网络防火墙（WAF）的核心是规则引擎，规则引擎实现了规则集的编排、计算，基于规则集能够实现丰富的拦截策略。

商业 WAF 产品的规则集包含：

1. **OWASP ModSecurity 核心规则集**
2. **平台托管规则集**
3. **用户自定义规则**

### 1.1. 规则集

#### 1.1.1. OWASP ModSecurity 核心规则集

> OWASP ModSecurity 核心规则集包含来自于 OWASP 项目的若干规则。平台不编写或管理 OWASP 规则。

**OWASP ModSecurity 核心规则集**根据触发的 OWASP 规则数量为每个请求指定一个分数。某些 OWASP 规则的敏感度分数高于其他规则。在 OWASP 评估请求后，Cloudflare 会将最终分数与为该域名配置的**危险阈值**进行比较。如果分数超过**危险阈值**，则根据 **OWASP ModSecurity 核心规则集**中配置的**操作**来处理这个请求。

- 阻止 - 请求被丢弃。
- 记录 - 放行请求，只记录审计日志。

对于具体的**危险阈值**，触发 WAF 所需的敏感度得分如下：

- 低 - 60 及以上
- 中 - 40 及以上
- 高 - 25 及以上

![img](/images/2021-11-01-05.png)

#### 1.1.2. 平台托管规则集

> 平台托管规则集包含由平台方编写和管理的安全规则。

针对 MSP 平台托管的服务大多数为前后端分离，API 调用的模式，针对平台服务定制。

**托管规则集**内各条规则可用的**模式**包括：

- 默认 - 采取查看具体规则时列在下的默认操作。
- 禁用 - 不启用规则集。
- 阻止 - 请求被丢弃。
- 记录 - 放行请求，只记录审计日志。

#### 1.1.3. 用户自定义规则集

允许用户对于路由级别启用 WAF 功能，设定自定义的 WAF 规则。

使用通用的 WAF 设置语法，平台提供统一的界面可视化操作。

![img](/images/2021-11-01-04.png)

### 1.2. 规则编写

置于 Kong 网关的 WAF 模块是基于 Lua 脚本（lua-resty-core）结合 C 模块 FFI 调用的高性能 WAF 库二次开发的。

其内置的规则引擎使用 JSON 编写，提供多种灵活的操作和组合。

#### 1.2.1. 规则示例

```json
{
   // 表示在 Nginx 中请求的 Access 阶段运行
   "access" : [ // 规则集使用数组, 按顺序编排
      {
         // 操作类型
         "actions" : {
            "disrupt" : "CHAIN" // 链式条件组合, 本身不执行任何动作
         },
         "id" : 11001, // 规则的 ID, 会在审计日志中使用
         "msg" : "Ignore passive requests with no arguments", // 规则的描述
         "operator" : "REFIND", // 规则的运算符，REFIND 代表 ngx.re.find, 通俗来说是 Match 运算
         "opts" : {
            "nolog" : true // 不记录日志
         },
         "pattern" : "^(?:GET|HEAD)$", // 匹配值的正则表达式, 匹配 GET 或 HEAD
         "vars" : [ 
            {
               "type" : "METHOD" // 匹配请求的字段名, 这里为 HTTP Method
            }
         ]
      },
      {
         "actions" : {
            "disrupt" : "ACCEPT" // 操作类型为允许
         },
         "id" : 11002,
         "msg" : "Ignore passive requests with no arguments",
         "op_negated" : 1, // 表示取反, 即不等于
         "operator" : "REFIND",
         "opts" : {
            "nolog" : true // 不记录日志
         },
         "pattern" : ".*", // 匹配任何值
         "vars" : [
            {
               "parse" : [ // 表示解析所有字符串
                  "all",
                  1
               ],
               "type" : "REQUEST_ARGS" // 匹配请求的字段, 这里为 URI 查询字符串
            }
         ]
      }
   ]
}
```

上述的示例规则表示：当传入的请求 “HTTP 请求方法” *正则匹配*  `^(GET/HEAD)$` ，且 "URI 查询字符串"  为空时，*允许* 该请求。

#### 1.2.2. 规则处理概述

![规则解析](/images/2021-11-01-03.png)

### 1.3. 规则编排

规则编排在 lua-resty-waf 中称作 ***规则预处理***，在 `rule_calc.lua` 文件中，主要的行为包含：

1. 规则主键条目唯一 KEY 构建
2. 规则组构建（索引优化）



#### 1.3.1. 规则主键计算

为每一行规则生成 KEY，作为缓存 KEY 使用。

将规则中 Lua Table 平铺为 String。

```lua
-- 生成 transform 的 KEY
local function _transform_collection_key(transform)
	if not transform then
		return nil
	end

	if type(transform) ~= 'table' then
		return tostring(transform)
	else
		return table_concat(transform, ',')
	end
end

-- 计算规则主键 (KEY)
local function _build_collection_key(var, transform)
	local key = {}
	-- TYPE 为规则查询的变量名
	key[1] = tostring(var.type)

	if var.parse ~= nil then
		table_insert(key, tostring(var.parse[1]))
		table_insert(key, tostring(var.parse[2]))
	end

	if var.ignore ~= nil then
		table_insert(key, tostring(_ignore_collection_key(var.ignore)))
	end

	table_insert(key, tostring(_transform_collection_key(transform)))

	return table_concat(key, "|")
end
```

`transform` 缓存在 Lua Table，规则主键作为 KEY 快速查找。

```lua
local function _build_collection(self, rule, var, collections, ctx, opts)
    ...

	-- 规则主键
	local collection_key = var.collection_key
	local collection

	--_LOG_"Checking for collection_key " .. collection_key

	if not var.storage and not ctx.transform_key[collection_key] then
		--_LOG_"Collection cache miss"
		-- 获取规则需要的所有数据
		-- 单个值或者数组
		collection = _parse_collection(self, collections[var.type], var)

		-- 对数据集进行转换
		if opts.transform then
			collection = _do_transform(self, collection, opts.transform)
		end

		-- Lua table 缓存已转换的数据集
		ctx.transform[collection_key]     = collection
		ctx.transform_key[collection_key] = true
	elseif var.storage then
		--_LOG_"Forcing cache miss"
		collection = _parse_collection(self, collections[var.type], var)
	else
		--_LOG_"Collection cache hit!"
		collection = ctx.transform[collection_key]
	end

    ...

	return collection
end
```



#### 1.3.2. 规则预处理

规则引擎对于规则匹配是遍历操作，预处理中为规则匹配成功或失败的后续行为做出判断，在规则条目中增加 `offset_match` 和 `offset_nomatch` 两个值。

```lua
-- 添加链规则 offset 
-- 接收参数  [规则链, 总规则数, 规则链起始 index]
local function _write_chain_offsets(chain, max, cur_offset)
	-- 规则链长度
	local chain_length = #chain
	-- 倒叙遍历 index
	local offset = chain_length

	-- 遍历规则
	for i = 1, chain_length do
		local rule = chain[i]

		-- 当前 chain 是否在最末尾
		if offset + cur_offset >= max then -- TODO 这个表达式可以简化
			rule.offset_nomatch = nil -- 默认, 没有下一条规则链了
			if rule.actions.disrupt == "CHAIN" then
				rule.offset_match = 1 -- 下次执行增加 1
			else
				rule.offset_match = nil -- 没有下一条规则链了
			end
		else
			rule.offset_nomatch = offset -- 跳过当前的剩余规则, 执行下一组规则
			rule.offset_match = 1
		end

		cur_offset = cur_offset + 1
		offset = offset - 1
	end
end
```

在规则遍历时，引擎会根据规则的 `offset` 决定下一行规则的索引，跳过不必要的规则执行，提升效率。



```lua
-- 规则集编排
function _M.calculate(ruleset, meta_lookup)
	-- 规则条目数
	local max = #ruleset
	-- 储存一条规则链
	local chain = {}

	-- 遍历规则集
	for i = 1, max do
		-- 单条规则
		local rule = ruleset[i]

		-- 是否有单独的配置项
		if not rule.opts then rule.opts = {} end

		-- 储存当前规则链
		chain[#chain + 1] = rule

		-- VAR 通常只有一个元素
		for i in ipairs(rule.vars) do
			local var = rule.vars[i]
			-- 计算规则主键
			var.collection_key = _build_collection_key(var, rule.opts.transform)
		end

		-- 规则的动作非 CHAIN, 可能是 [ACCEPT,DENY,DROP,IGNORE]
		if rule.actions.disrupt ~= "CHAIN" then
			-- 计算规则链增加的 step
			-- 传入参数 [规则链, 总规则数, 规则链起始 index]
			_write_chain_offsets(chain, max, i - #chain)

			if rule.skip then
				-- 跳过一组规则
				_write_skip_offset(rule, max, i)
			elseif rule.skip_after then
				...
			end

			-- 跳出当前规则链
			chain = {}
		end

		...
	end
end
```



示意图：

![image-20210813182139716](/images/2021-11-01-06.png)



### 1.4. 数据绑定

#### 1.4.1. 数据集构建

规则引擎在每次处理请求时，都要进行数据集的构建，数据集包含了 Nginx 请求的基本信息，例如 HTTP Header，URI，URI 查询字符串等。

规则引擎会根据每个执行阶段（Phase）加载对于的环境变量。

```lua
-- 规则解析, 数据绑定, TODO 只加载必要的数据
_M.lookup = {
	access = function(waf, collections, ctx)
		local request_headers     = ngx.req.get_headers()
		local request_var         = ngx.var.request
		local request_method      = ngx.req.get_method()
		local request_uri_args    = ngx.req.get_uri_args()
		local request_uri         = request.request_uri()
		local request_uri_raw     = request.request_uri_raw(request_var, request_method)
		local request_basename    = request.basename(waf, ngx.var.uri)
		local request_body        = request.parse_request_body(waf, request_headers, collections)
		local request_cookies     = request.cookies() or {}
		local request_common_args = request.common_args({ request_uri_args, request_body, request_cookies })
		local query_string        = ngx.var.query_string

		local query_str_size = query_string and #query_string or 0
		local body_size = ngx.var.http_content_length and tonumber(ngx.var.http_content_length) or 0

		collections.REMOTE_ADDR       = ngx.var.remote_addr
		collections.HTTP_VERSION      = ngx.req.http_version()
		collections.METHOD            = request_method
		collections.URI               = ngx.var.uri
		collections.URI_ARGS          = request_uri_args
		collections.QUERY_STRING      = query_string
		collections.REQUEST_URI       = request_uri
		collections.REQUEST_URI_RAW   = request_uri_raw
		collections.REQUEST_BASENAME  = request_basename
		collections.REQUEST_HEADERS   = request_headers
		collections.COOKIES           = request_cookies
		collections.REQUEST_BODY      = request_body
		collections.REQUEST_ARGS      = request_common_args
		collections.REQUEST_LINE      = request_var
		collections.PROTOCOL          = ngx.var.server_protocol
		collections.TX                = ctx.storage["TX"]
		collections.NGX_VAR           = ngx.var
		collections.MATCHED_VARS      = {}
		collections.MATCHED_VAR_NAMES = {}
		collections.SCORE_THRESHOLD   = waf._score_threshold -- 危险阈值
        ...
	end,
	header_filter = function(waf, collections)
		local response_headers = ngx.resp.get_headers()

		collections.RESPONSE_HEADERS = response_headers
		collections.STATUS           = ngx.status
	end,
	body_filter = function(waf, collections, ctx)
		...
	end,
	log = function() end
}
```



#### 1.4.2. 数据转换

WAF 的规则中通常会提供多种常用的运算函数，例如 `tonumber()`, `lowercase()` 等，也会提供常规变量使用，例如 `${geo_ip}` 。

规则引擎需要对其进行转换，动态解析出真实的变量，以便后续进行运算操作。



项目提供的常用的 *转换函数* 有：

```lua
_M.lookup = {
	base64_decode = function(waf, value)
		--_LOG_"Decoding from base64: " .. tostring(value)
		-- 使用 lua-resty-core 解码 base64
		local t_val = ngx.decode_base64(tostring(value))
		if t_val then
			--_LOG_"Decode successful, decoded value is " .. t_val
			return t_val
		else
			--_LOG_"Decode unsuccessful, returning original value " .. value
			return value
		end
	end,
	base64_encode = function(waf, value)
		--_LOG_"Encoding to base64: " .. tostring(value)
		local t_val = ngx.encode_base64(value)
		--_LOG_"Encoded value is " .. t_val
		return t_val
	end,
	-- 替换空白字符, 正则匹配将多个空格字符 (空格/tab) 转换为单个空格
	compress_whitespace = function(waf, value)
		return ngx.re.gsub(value, [=[\s+]=], ' ', waf._pcre_flags)
	end,
	-- htmlentities 包, 针对 API 较多的情况应该避免解析 HTML
	html_decode = function(waf, value)
		local str = hdec.decode(value)
		--_LOG_"html decoded value is " .. str
		return str
	end,
	-- [经常使用]
	lowercase = function(waf, value)
		return string_lower(tostring(value))
	end,
	
    --- 此处省略不常用的转换函数...
    
	-- [经常使用]
	uri_decode = function(waf, value)
		return ngx.unescape_uri(value)
	end,
}
```

对数据集进行转换，输出转换后的数据集：

```lua
-- transform collection values based on rule opts
local function _do_transform(self, collection, transform)
	local t = {}

	-- transform 函数可能是数组
	if type(transform) == "table" then
		t = collection

		for k, v in ipairs(transform) do
			-- 对数据集执行转换函数
			t = _do_transform(self, t, transform[k])
		end
	else
		-- 执行单个转换函数，递归执行
		if type(collection) == "table" then
			for k, v in pairs(collection) do
				t[k] = _do_transform(self, collection[k], transform)
			end
		else
			if not collection then
				return collection
			end

			return transform_t.lookup[transform](self, collection)
		end
	end

	return t
end
```



在规则处理中动态解析变量：

```lua
-- 动态获取要对比的值
if opts.parsepattern then
    --_LOG_"Parsing dynamic pattern: " .. pattern
    pattern = util.parse_dynamic_value(self, pattern, collections)
end
```

从数据集中动态获取变量：

```lua
-- pick out dynamic data from storage key definitions
function _M.parse_dynamic_value(waf, key, collections)
	local lookup = function(macro)
		local val, specific
		-- cheat on the start index
		local dot = string_find(macro, "%.", 5)
		if dot then
			val = string_sub(macro, 3, dot - 1)
			specific = string_sub(macro, dot + 1, -2)
		else
			val = string_sub(macro, 3, -2)
		end

		local lval = collections[val]

		if type(lval) == "table" then
			if specific then
				return lval[specific] and tostring(lval[specific]) or
					tostring(lval[string.lower(specific)])
			else
				return val
			end
		else
			return lval
		end
	end

	local str = string_gsub(key, "%%%b{}", lookup)

	--_LOG_"Parsed dynamic value is " .. str

	return tonumber(str) and tonumber(str) or str
end
```



### 1.5. 规则运算

WAF 规则运算符通常包含 *等于、不等于、包含、不包含、正则匹配*  等符号。

规则引擎具体通过 lua-resty-core、lua-nginx-module、Lua JIT 提供的方法进行数据比较，该项目中也用到了第三方库，有用作字符串多模式匹配的 [AC 自动机 Lua FFI 库](https://github.com/cloudflare/lua-aho-corasick/)（C 实现），和检测 SQL 注入和 XSS 的 [libinjection](https://github.com/client9/libinjection) 库（C 实现）。



较为常用的有正则匹配的 `ngx.re.match` 和 `ngx.re.find` 函数，两者都用了 PCRE 优化的参数 `jio`，表示编译结果缓存、启用 Lua JIT 优化、大小写不敏感，后者相比 match 函数，只返回匹配字符串的索引，更为高效。

```lua
-- match 正则匹配
---@return boolean, string[] 
function _M.regex(waf, subject, pattern)
	-- Lua JIT 优化参数
	local opts = waf._pcre_flags
	local captures, err, match

	if type(subject) == "table" then
		for _, v in ipairs(subject) do
			match, captures = _M.regex(waf, v, pattern)

			if match then
				break
			end
		end
	else
		captures, err = ngx.re.match(subject, pattern, opts)

		if err then
			logger.warn(waf, "error in ngx.re.match: " .. err)
		end

		if captures then
			match = true
		end
	end

	return match, captures
end

-- 正则匹配 ngx.re.find, 只返回匹配字符串的 index
---@return boolean, number
function _M.refind(waf, subject, pattern)
	local opts = waf._pcre_flags
	local from, to, err, match

	if type(subject) == "table" then
		for _, v in ipairs(subject) do
			match, from = _M.refind(waf, v, pattern)

			if match then
				break
			end
		end
	else
		from, to, err = ngx.re.find(subject, pattern, opts)

		if err then
			logger.warn(waf, "error in ngx.re.find: " .. err)
		end

		if from then
			match = true
		end
	end

	return match, from
end
```



AC 自动机进行字符串匹配，首先创建 Trie 前缀树和 Fail 指针，构建结果缓存在 Lua Table 中，避免重复创建的性能损耗，在项目示例规则集中，主要用于 user-agent 的匹配。

```lua

-- AC 自动机字符串查找
---@return boolean, string
function _M.ac_lookup(needle, haystack, ctx)
	local id = ctx.id
	local match, _ac, value

	-- dictionary creation is expensive, so we use the id of
	-- the rule as the key to cache the created dictionary
	-- 使用 Lua Table 缓存字典
	if not _ac_dicts[id] then
		_ac = ac.create_ac(haystack)
		_ac_dicts[id] = _ac
	else
		_ac = _ac_dicts[id]
	end

	if type(needle) == "table" then
		for _, v in ipairs(needle) do
			match, value = _M.ac_lookup(v, haystack, ctx)

			if match then
				break
			end
		end
	else
		match = ac.match(_ac, needle)

		if match then
			match = true
			value = needle
		end
	end

	return match, value
end
```



常用的规则运算符如下，返回 *是否匹配成功，匹配的结果*。

```lua
-- 操作符
-- 接收参数 [waf 实例, 数据集, 匹配参数]
---@return boolean, string|number
_M.lookup = {
	REGEX        = function(waf, collection, pattern) return _M.regex(waf, collection, pattern) end,
	REFIND       = function(waf, collection, pattern) return _M.refind(waf, collection, pattern) end,
	EQUALS       = function(waf, collection, pattern) return _M.equals(collection, pattern) end,
	GREATER      = function(waf, collection, pattern) return _M.greater(collection, pattern) end,
	LESS         = function(waf, collection, pattern) return _M.less(collection, pattern) end,
	GREATER_EQ   = function(waf, collection, pattern) return _M.greater_equals(collection, pattern) end,
	LESS_EQ      = function(waf, collection, pattern) return _M.less_equals(collection, pattern) end,
	EXISTS       = function(waf, collection, pattern) return _M.exists(collection, pattern) end,
	CONTAINS     = function(waf, collection, pattern) return _M.contains(collection, pattern) end,
	STR_EXISTS   = function(waf, collection, pattern) return _M.str_find(waf, pattern, collection) end,
	STR_CONTAINS = function(waf, collection, pattern) return _M.str_find(waf, collection, pattern) end,
	-- AC 自动机匹配
	PM           = function(waf, collection, pattern, ctx) return _M.ac_lookup(collection, pattern, ctx) end,
	CIDR_MATCH   = function(waf, collection, pattern) return _M.cidr_match(collection, pattern) end,
	RBL_LOOKUP   = function(waf, collection, pattern, ctx) return _M.rbl_lookup(waf, collection, pattern, ctx) end,
	DETECT_SQLI  = function(waf, collection, pattern) return _M.detect_sqli(collection) end,
	DETECT_XSS   = function(waf, collection, pattern) return _M.detect_xss(collection) end,
	STR_MATCH    = function(waf, collection, pattern) return _M.str_match(collection, pattern) end,
	VERIFY_CC    = function(waf, collection, pattern) return _M.verify_cc(waf, collection, pattern) end,
}
```



### 1.6. 执行动作

#### 1.6.1. 非数据操作类型

规则引擎的操作通常有 *允许、阻止、忽略、记录*。

>  Cloudflare 有额外的执行动作：质询，我们经常可见的 CF 五秒盾后的验证码就是该动作。

```lua
-- 数据操作类型, 区别于 ACCEPT, CHAIN, IGNORE
_M.alter_actions = {
	DENY   = true,
	DROP   = true,
}

_M.disruptive_lookup = {
	ACCEPT = function(waf, ctx)
		--_LOG_"Rule action was ACCEPT, so ending this phase with ngx.OK"
		if waf._mode == "ACTIVE" then
			-- TODO 允许操作仍然返回后端状态码
			ngx.exit(ngx.OK)
		end
	end,
	CHAIN = function(waf, ctx)
		--_LOG_"Chaining (pre-processed)"
	end,
	DENY = function(waf, ctx)
		--_LOG_"Rule action was DENY, so telling nginx to quit"
		if waf._mode == "ACTIVE" then
			ngx.exit(ctx.rule_status or waf._deny_status)
		end
	end,
	DROP = function(waf, ctx)
		--_LOG_"Rule action was DROP, ending eith ngx.HTTP_CLOSE"
		if waf._mode == "ACTIVE" then
			ngx.exit(ngx.HTTP_CLOSE)
		end
	end,
	IGNORE = function(waf)
		--_LOG_"Ignoring rule for now"
	end,
	-- SCORE 类型废弃，使用 TX 设置危险分数
	SCORE = function(waf, ctx)
		--_LOG_"Score isn't a thing anymore, see TX.anomaly_score"
	end,
}
```



#### 1.6.2. 数据操作类型

OWASP ModSecurity 规则中有变量的操作，例如 `set_var` 以及增加威胁分数的操作，都是属于数据操作类型。

```lua
-- 额外操作类型
_M.nondisruptive_lookup = {
	deletevar = function(waf, data, ctx, collections)
		storage.delete_var(waf, ctx, data)
	end,
	expirevar = function(waf, data, ctx, collections)
		local time = util.parse_dynamic_value(waf, data.time, collections)

		storage.expire_var(waf, ctx, data, time)
	end,
	initcol = function(waf, data, ctx, collections)
		local col    = data.col
		local value  = data.value
		local parsed = util.parse_dynamic_value(waf, value, collections)

		--_LOG_"Initializing " .. col .. " as " .. parsed

		storage.initialize(waf, ctx.storage, parsed)
		ctx.col_lookup[col] = parsed
		collections[col]    = ctx.storage[parsed]
	end,
	setvar = function(waf, data, ctx, collections)
		data.key    = util.parse_dynamic_value(waf, data.key, collections)
		local value = util.parse_dynamic_value(waf, data.value, collections)

		storage.set_var(waf, ctx, data, value)
	end,
	...
}
```

数据操作类型通常会设置变量，lua-resty-waf 中支持在 Nginx 共享内存和 Redis 中设置全局变量，在规则计算中使用。



### 1.7. 待优化

规则引擎中有部分操作明显可以优化，此处包含：

1. 数据集构建，引擎只需要规则定义中包含的字段，除此以外的数据获取是无效的
2. IPDR 匹配，纯 Lua 比较相比 C 库 FFI 调用效率较为低效

