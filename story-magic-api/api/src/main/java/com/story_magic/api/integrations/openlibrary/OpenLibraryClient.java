package com.story_magic.api.integrations.openlibrary;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.story_magic.api.integrations.ExternalServiceException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Component
public class OpenLibraryClient implements OpenLibrarySearchProvider {

	private static final String SEARCH_URL = "https://openlibrary.org/search.json";
	private static final String USER_AGENT = "StoryMagic/1.0 (open book catalog)";
	private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
	private static final String FIELDS = "title,author_name,first_publish_year,cover_i,edition_count,"
			+ "editions,editions.title,editions.language,editions.cover_i";

	private final HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(5))
			.followRedirects(HttpClient.Redirect.NORMAL)
			.build();
	private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

	@Override
	public List<OpenLibraryBookDocument> search(String query) {
		String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
		URI uri = URI.create(SEARCH_URL
				+ "?q=" + encodedQuery
				+ "&fields=" + URLEncoder.encode(FIELDS, StandardCharsets.UTF_8)
				+ "&limit=20&lang=pt");
		HttpRequest request = HttpRequest.newBuilder(uri)
				.timeout(REQUEST_TIMEOUT)
				.header("User-Agent", USER_AGENT)
				.header("Accept", "application/json")
				.GET()
				.build();

		try {
			HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() != 200) {
				throw new ExternalServiceException(
						HttpStatus.BAD_GATEWAY,
						"Open Library respondeu com HTTP " + response.statusCode() + ".",
						null);
			}
			return parseResponse(response.body());
		} catch (HttpTimeoutException exception) {
			throw new ExternalServiceException(
					HttpStatus.GATEWAY_TIMEOUT,
					"A busca no Open Library demorou demais para responder.",
					exception);
		} catch (IOException exception) {
			throw new ExternalServiceException(
					HttpStatus.BAD_GATEWAY,
					"Não foi possível consultar o Open Library.",
					exception);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new ExternalServiceException(
					HttpStatus.BAD_GATEWAY,
					"A consulta ao Open Library foi interrompida.",
					exception);
		} catch (JacksonException exception) {
			throw new ExternalServiceException(
					HttpStatus.BAD_GATEWAY,
					"O Open Library retornou uma resposta inválida.",
					exception);
		}
	}

	private record SearchResponse(List<OpenLibraryBookDocument> docs) {
	}

	static List<OpenLibraryBookDocument> parseResponse(String body) throws JacksonException {
		SearchResponse result = JSON_MAPPER.readValue(body, SearchResponse.class);
		return result.docs() == null ? List.of() : result.docs();
	}
}
