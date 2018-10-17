const { existsSync: exists } = require('fs');
const { Mixin } = require('hops-mixin');
const strip = require('strip-indent');
const {
  internal: { createWebpackMiddleware, StatsFilePlugin },
} = require('@untool/webpack');

class GraphQLMixin extends Mixin {
  registerCommands(yargs) {
    yargs.command('graphql', 'Execute GraphQL specific tasks', yargs =>
      yargs
        .usage('Usage: hops graphql <command>')
        .command({
          command: 'introspect',
          describe: 'Fetches GraphQL schema information for introspection',
          builder: {
            header: {
              alias: 'H',
              type: 'array',
              default: [],
              describe: strip(`
                Additional HTTP headers to be used when executing the schema
                introspection on the remote server. Specify this multiple
                times to add more headers.\nFormat: "Header: Value"
              `),
            },
          },
          handler: argv => {
            require('./lib/fragments')({
              graphqlUri: this.config.graphqlUri,
              schemaFile: this.config.graphqlSchemaFile,
              fragmentsFile: this.config.fragmentsFile,
              headers: argv.header,
            })
              .then(() => {
                console.log('Fetched and saved GraphQL fragments');
              })
              .catch(err => {
                console.error('Could not fetch GraphQL fragments:');
                console.trace(err);
              });
          },
        })
        .help('help')
        .alias('h', 'help')
        .demandCommand()
    );
  }

  configureServer(rootApp, middleware, mode) {
    if (
      !this.config.graphqlMockSchemaFile ||
      !exists(this.config.graphqlMockSchemaFile) ||
      mode !== 'develop'
    ) {
      return;
    }

    middleware.preroutes.unshift(
      createWebpackMiddleware(
        this.getBuildConfig('graphql-mock-server', 'node'),
        true
      )
    );
  }

  configureBuild(webpackConfig, loaderConfigs, target) {
    const { allLoaderConfigs } = loaderConfigs;

    const tagLoader = {
      test: /\.(graphql|gql)$/,
      loader: 'graphql-tag/loader',
    };
    allLoaderConfigs.splice(allLoaderConfigs.length - 1, 0, tagLoader);

    webpackConfig.externals.push('encoding');

    if (target === 'graphql-mock-server') {
      webpackConfig.externals.push(
        'apollo-server-express',
        'express',
        'graphql'
      );

      webpackConfig.output.filename = 'hops-graphql-mock-server.js';

      Object.assign(webpackConfig.resolve.alias, {
        'hops-graphql/schema': require.resolve(
          this.config.graphqlMockSchemaFile
        ),
        '@untool/entrypoint': require.resolve('./lib/mock-server-middleware'),
      });

      webpackConfig.plugins = webpackConfig.plugins.filter(
        p => !(p instanceof StatsFilePlugin)
      );
    }
  }
}

module.exports = GraphQLMixin;
