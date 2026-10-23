-- Install after schema.sql. Quantos leitores cada livro tem (prova social nos cards).
-- Só devolve o total por livro: nunca quem leu. Conta quem tem o livro no progresso
-- ("storyverse:reading-progress", chave = gutenbergId) ou nos terminados
-- ("storyverse:finished-books", chave = id do livro) do reading_state sincronizado.
-- Na API própria, incluir "book_reader_counts" na lista branca do RpcService.

-- Texto que não é JSON válido (gravado à mão por alguém) conta como vazio, em vez de
-- derrubar a contagem de todo mundo.
create or replace function public.try_jsonb(p_text text)
returns jsonb language plpgsql immutable as $$
begin
  return coalesce(p_text, '{}')::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

create or replace function public.book_reader_counts(p_ids text[], p_gids text[])
returns table (book_id text, readers integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, count(s.user_id)::integer
  from unnest(p_ids[1:60], p_gids[1:60]) as b(id, gid)
  left join public.reading_state s
    on jsonb_typeof(public.try_jsonb(s.data->>'storyverse:reading-progress')) = 'object'
      and public.try_jsonb(s.data->>'storyverse:reading-progress') ? b.gid
    or jsonb_typeof(public.try_jsonb(s.data->>'storyverse:finished-books')) = 'object'
      and public.try_jsonb(s.data->>'storyverse:finished-books') ? b.id
  where b.id is not null
  group by b.id;
$$;

revoke execute on function public.try_jsonb(text) from public, anon, authenticated;
revoke execute on function public.book_reader_counts(text[], text[]) from public, anon;
grant execute on function public.book_reader_counts(text[], text[]) to authenticated;
