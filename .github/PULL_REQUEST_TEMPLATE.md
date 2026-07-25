## PR title

Use a concise task title without tool or agent prefixes.

Good: `Validate project paths before writing files`
Bad: `[codex] Validate project paths before writing files`

## Summary

Кратко опиши, что изменено и зачем.

## Changed files

- `path/to/file` — что изменено.

## Validation

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `npm start` and relevant scenarios checked manually
- [ ] affected platform package built and smoke-tested
- [ ] not applicable

Если проверка не запускалась, объясни почему.

## Visual check

- [ ] создание и открытие проекта
- [ ] загрузка TOP/BOTTOM изображений
- [ ] добавление и редактирование компонентов
- [ ] этапы, группы, поиск и фильтры
- [ ] режим пайки и прогресс
- [ ] не применимо

Комментарий:

## Not changed intentionally

- [ ] формат `project.json`
- [ ] расположение пользовательских проектов
- [ ] IPC API между renderer и main process
- [ ] Electron security settings
- [ ] зависимости
- [ ] packaging configuration

## Branch cleanup

- [ ] PR branch can be deleted after merge.

## Risks

Опиши риски изменения и что может потребовать отдельной проверки.

## Links

Refs #
