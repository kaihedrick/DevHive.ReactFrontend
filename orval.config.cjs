module.exports = {
  'devhive-api': {
    input: {
      target: process.env.REACT_APP_API_BASE_URL ? `${process.env.REACT_APP_API_BASE_URL.replace('/api/v1', '')}/api/v1/openapi.json` : 'https://devhive-go-backend.fly.dev/api/v1/openapi.json',
    },
    output: {
      target: 'src/api/generated',
      schemas: 'src/api/types',
      client: 'react-query', // or 'axios' for axios-based client
      mode: 'tags-split',
      clean: true,
      prettier: true,
    },
    hooks: {
      afterAllFilesWrite: ['prettier --write'],
    },
  },
};
