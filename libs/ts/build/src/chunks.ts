// FIXME NOTE не забыть, что если ошибка рендеринга в проде - значит неправильно поделено на чанки!!!
// Когда есть кольцевая зависимость в vendor - некоторые переменные не могут быть заэкспортированы и считаются undefined
// Кольцевые зависимости нужно разруливать на уровне чанков ручками

export const defaultManualChunks = (path: string, currentDir: string): string => {
  if (path.includes(`${currentDir}/src`) || path.includes(`${currentDir}/index`)) {
    return 'index';
  }
  if (path.includes('internet-identity')) {
    return 'ii';
  }
  if (path.includes('/polyfill')) {
    return 'vendor';
  }
  if (path.includes('validation-poc/libs')) {
    return 'libs';
  }

  const id = path.slice(path.indexOf('node_modules/') + 1);

  if (id.includes('@dfinity')) {
    return 'dfinity';
  }
  if (id.includes('react')) {
    return 'react';
  }
  if (id.includes('mobx')) {
    return 'mobx';
  }
  if (id.includes('@mui') || id.includes('@popper')) {
    return 'material';
  }
  if (id.includes('styled')) {
    return 'styled';
  }
  return 'vendor';
};
