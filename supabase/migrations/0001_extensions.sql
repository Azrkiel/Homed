-- Extensions live in the extensions schema (keeps PostGIS system tables out of public). Later migrations qualify types and functions as extensions.*.
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
