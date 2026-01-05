import { parse, compileScript, compileTemplate, rewriteDefault } from '@vue/compiler-sfc'
import { readFileSync } from 'fs'

export default function vuePlugin() {
  return {
    name: 'vue-sfc',
    setup(build) {
      build.onLoad({ filter: /\.vue$/ }, async (args) => {
        const source = readFileSync(args.path, 'utf-8')
        const { descriptor, errors } = parse(source, { filename: args.path })

        if (errors.length > 0) {
          return { errors: errors.map(e => ({ text: e.message })) }
        }

        const id = args.path.replace(/[\/\\]/g, '_')
        let code = ''

        // Compile script
        if (descriptor.script || descriptor.scriptSetup) {
          const scriptResult = compileScript(descriptor, {
            id,
            inlineTemplate: false,
          })
          code += rewriteDefault(scriptResult.content, '__sfc_main__')
        } else {
          code += 'const __sfc_main__ = {}'
        }

        // Compile template
        if (descriptor.template) {
          const templateResult = compileTemplate({
            source: descriptor.template.content,
            filename: args.path,
            id,
            compilerOptions: {
              bindingMetadata: descriptor.script || descriptor.scriptSetup
                ? compileScript(descriptor, { id }).bindings
                : undefined,
            },
          })

          code += '\n' + templateResult.code
          code += '\n__sfc_main__.render = render'
        }

        // Handle scoped styles (just extract, don't process)
        if (descriptor.styles.length > 0) {
          const scopedStyles = descriptor.styles
            .filter(s => s.scoped)
            .map(s => s.content)
            .join('\n')
          if (scopedStyles) {
            code += `\n__sfc_main__.__scopeId = "data-v-${id}"`
          }
        }

        code += '\nexport default __sfc_main__'

        return {
          contents: code,
          loader: 'js',
        }
      })
    },
  }
}
