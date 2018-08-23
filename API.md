# Downson.js API

The library exposes a single top-level function, `downson`. Additional fields and functions are properties of this function.

## downson(input: string, options: object = { downson: { }, marked: { } }): object

Parses the passed Markdown input and returns the extracted data layer along with the failures that have occurred. Uses the `marked` lexer and parser to process Markdown, which is then fed into a downson lexer and parser. The Markdown processing phase can be fine-tuned by the `options.marked` property which accepts the very same settings as the vanilla `marked` library – see the reference [here](https://marked.js.org/#/USING_ADVANCED.md#options).

The actual options passed to the Markdown and the downson phases are assembled from the passed `options` object and the value of the `downson.defaultOptions` property.

**Parameters**

  * `input: string` - The Markdown input string.
  * `options: object` - An optional object to control the parsing and data extraction process. The accepted properties are the following:
      * `marked: object = {}` - Settings for the underlying `marked` Markdown lexer and parser.
      * `silent: boolean` - If set to `true`, then downson will not throw on fatal exceptions

**Throws**

  * If the `input` parameter is not a `string`.
  * If `options.silent` is set to `true` and a fatal error occurs during the process.

**Returns**

The function returns an `object` with the following properties:

  * `data: object` - The data layer defined by the downson document.
  * `failures: Array[Failure]` - The list of failures encountered during the data extraction process. A `Failure` object has the following properties:
      * `reason: string` - The reason that caused the failure.
      * `token: object` - The violating token.
      * `type: string` - Can be `ambiguousSyntax` or `interpretationError`.
  * `hasInterpretationErrors: boolean` - Whether the `failures` array includes any objects with `interpretationError` type.

If `options.silent` is set to true and a fatal error occurs, then the following value is returned:

~~~~JavaScript
{
    data: {},
    failures: [],
    hasInterpretationErrors: false
}
~~~~

### downson.getFactoryDefaults(): object

Returns the unmodified default settings. 

**Returns**

An `object` with the following properties:

  * `downson: object` - Settings for the downson phase.
  * `marked: object` - Settings for the Markdown phase.
  * `silent: boolean` - If set to `true`, then downson will not throw on fatal exceptions

For the actual values, refer to the [Factory Defaults](#factory-defaults) section below.
 
#### Factory Defaults

**downson** - Currently, an empty object.

**marked** - See the `marked` [reference](https://marked.js.org/#/USING_ADVANCED.md#options)

**silent** - `false`.

### downson.defaultOptions: object

The options object used as a basis when the `downson` function is called. By default, it's set to the [Factory Defaults](#factory-defaults).

### downson.registerType(type: string, converterMethod: (type: string, literal: string) => ConversionSuccess | ConversionError): void

Registers a new custom primitive type. The passed converter method is going to be called by `downson` when a literal of the specified type is encountered.

Converters should return either of the following types:

  * `ConversionSuccess` - If the conversion was successful. Properties:
      * `value: any` - The value of the converted literal.
  * `ConversionError` - If an error occurred during the conversion. Properties:
      * `error: string` - The cause of the error.

**Parameters**

  * `type: string` - The name of the custom primitive type.
  * `converterMethod: (type: string, literal: string) => ConversionSuccess | ConversionError` - The converter method that creates values from literals.

**Throws**

  * If the `type` is not a `string`.
  * If the `converterMethod` is not a `function`.

### downson.deregisterType(type: string): boolean

Deregisters the specified custom primitive type.

**Parameters**

  * `type: string` - The name of the custom primitive type.

**Throws**

  * If `type` is a not a `string`.

**Returns**

`true` if the type (and its converter) has been removed, `false` otherwise.
