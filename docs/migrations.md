# Creating and undoing migrations

Opine uses Drizzle Kit **0.31.11**, resolved by `pnpm-lock.yaml`. Schema definitions belong to their feature; `server/db/schema.ts` aggregates them, and `drizzle/` contains one committed migration history. Run commands from the repository root.

`pnpm db:migrate` reads `DATABASE_URL` from `.env`; an exported value takes precedence. Check the target before applying changes. Generation and migration-history checks work on files; they do not apply changes to the database.

## Create a migration

1. Edit the owning schema, usually `layers/<feature>/server/schema.ts`. Export new tables through `server/db/schema.ts`. Update the affected application code and tests.
2. Generate a named migration:

   ```sh
   pnpm db:generate --name=add_feedback_field
   ```

3. Review the generated SQL and the changes under `drizzle/meta/`, including `_journal.json`. Check rename prompts carefully: dropping and recreating a column can lose data. For required fields on existing rows, plan the default or backfill before adding a `NOT NULL` constraint.
4. Check the migration history, then apply it to your development database:

   ```sh
   pnpm db:check
   pnpm db:migrate
   ```

5. Run `pnpm test:integration` and the relevant application checks. A migration that transforms existing data needs an upgrade test with representative old rows, not just an empty-database test. See [Testing](testing.md).
6. Commit schema, SQL, snapshots, journal, application changes and tests together. Once shared or applied to a database whose data matters, preserve the migration unchanged.

Generation compares the TypeScript schema with the previous migration snapshot, not the live database. `db:check` checks migration files, not connectivity or live schema drift. See Drizzle's [generation](https://orm.drizzle.team/docs/drizzle-kit-generate) and [migration](https://orm.drizzle.team/docs/drizzle-kit-migrate) references.

Run `pnpm db:migrate` again to verify applied migrations are not rerun. Do not use `drizzle-kit push` for shared databases; keep changes in reviewed migration files. Application startup never applies migrations automatically.

For a data-only change that cannot be expressed by schema generation:

```sh
pnpm db:generate --custom --name=backfill_feedback_field
```

Write the SQL in the generated empty migration, review it, and follow the same check/test/commit workflow. Keep schema changes in ordinary generated migrations so snapshots continue to describe the intended schema.

## Undo a migration

There is no database `down` command in this project's Drizzle workflow. Choose based on whether the migration has been shared or applied, and whether the database is disposable.

### Generated locally, never applied or shared

For the latest unpublished migration only:

```sh
pnpm exec drizzle-kit drop
```

Select the latest migration in the interactive prompt. In the installed 0.31.11 CLI this removes its SQL file and snapshot and updates the local journal. It does **not** undo SQL in a database. The prompt allows selecting older entries, so check the selection rather than removing an entry from the middle of the history.

Revert the corresponding schema and application changes as well, or edit them to the desired replacement and generate again. Inspect `git diff` and run `pnpm db:check`. Do not delete only the SQL file or manually remove rows from `drizzle.__drizzle_migrations`.

The current upstream [v1 upgrade guide](https://orm.drizzle.team/docs/upgrade-v1) describes a newer migration layout and removal of `drop`. That does not describe this repository's locked 0.31.11 installation. Revisit these instructions when upgrading Drizzle.

### Applied only to your disposable development database

If the migration is unpublished and all local data can be discarded, restore the intended schema, application code and complete migration history in Git first. For a new unpublished migration, remove its artifacts as above. Then stop the development server and recreate **only this project's local Compose database**:

```sh
# Permanently deletes this Compose project's PostgreSQL volume and all its data.
docker compose down --volumes
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
```

Before running this sequence, confirm the Compose project is your disposable development installation and `DATABASE_URL` points to the recreated local database. Do not use it for shared databases or data you need to keep. Accounts and privileges must be recreated after the reset. Seeding example data is optional.

`pnpm db:reset` is not a migration rollback: it clears application rows while retaining the current schema and migration history. If local data matters, keep the existing history and use the next approach instead.

### Shared, deployed, or applied to data you need to retain

Keep the original migration and create a new **compensating migration** that moves the current database to the desired state:

1. Change the TypeScript schema to the desired state and adjust the application code.
2. Run `pnpm db:generate --name=restore_previous_feedback_shape` and review the generated SQL. Use a custom migration for a data-only correction.
3. Back up the installation. Test the correction against an isolated restored database, including affected data, before applying it to the real installation.
4. Apply the new migration through the normal deployment procedure and commit the complete change.

Restoring the old schema does not restore lost values. Recreating a dropped column produces a new column, and reversing a destructive data update may be impossible without a backup. Use the [backup and restoration procedure](deployment.md#restore-into-an-isolated-installation) when data recovery is required; validate the restored installation before switching traffic. Reverting an application commit alone also does not revert the database schema.

Finally, `drizzle-kit up` upgrades migration snapshot formats; it is not the opposite of `down` and does not apply application migrations. The installed CLI and Drizzle's [up reference](https://orm.drizzle.team/docs/drizzle-kit-up) distinguish that from `migrate`.
