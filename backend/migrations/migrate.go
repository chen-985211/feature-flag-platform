package migrations

import (
	"embed"
	"errors"
	"regexp"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

//go:embed *.sql
var sourceFiles embed.FS
var schemaPattern = regexp.MustCompile(`^[a-z][a-z0-9_]{0,62}$`)

// Apply owns its connection. Zero steps applies all pending migrations; -1 rolls back one.
func Apply(databaseURL, schema string, steps int) (result error) {
	if !schemaPattern.MatchString(schema) || (steps != 0 && steps != -1) {
		return errors.New("invalid migration options")
	}
	cfg, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		return errors.New("invalid database settings")
	}
	cfg.ConnectTimeout = 5 * time.Second
	cfg.RuntimeParams["search_path"] = schema
	cfg.RuntimeParams["statement_timeout"] = "10000"
	db := stdlib.OpenDB(*cfg)
	driver, err := migratepgx.WithInstance(db, &migratepgx.Config{SchemaName: schema})
	if err != nil {
		return errors.Join(err, db.Close())
	}
	source, err := iofs.New(sourceFiles, ".")
	if err != nil {
		return errors.Join(err, driver.Close())
	}
	runner, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		return errors.Join(err, source.Close(), driver.Close())
	}
	defer func() { sourceErr, databaseErr := runner.Close(); result = errors.Join(result, sourceErr, databaseErr) }()
	runner.LockTimeout = 30 * time.Second
	if steps == 0 {
		err = runner.Up()
	} else {
		err = runner.Steps(steps)
	}
	if errors.Is(err, migrate.ErrNoChange) {
		return nil
	}
	return err
}
