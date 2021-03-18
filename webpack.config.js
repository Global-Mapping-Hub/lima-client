module.exports = {
	entry: './app/index.js',
	output: {
		filename: 'bundle.js'
	},
	target: 'web',
	devServer: {
		contentBase: './dist'
	},
	module: {
		rules: [{
				test: /\.js$/, //using regex to tell babel exactly what files to transcompile
				exclude: /node_modules/, // files to be ignored
				use: {
					loader: 'babel-loader' // specify the loader
				}
			}, {
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader'
				]
			}, {
				test: /\.svg$/,
				use: [{
					loader: 'svg-url-loader',
					options: {
						limit: 10000
					}
				}]
			}, {
				test: /\.(png|jpe?g|gif)$/i,
				use: [{
					loader: 'file-loader'
				}]
			},
		]
	}
}