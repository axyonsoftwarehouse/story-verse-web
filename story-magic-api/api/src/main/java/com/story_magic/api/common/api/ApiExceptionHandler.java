package com.story_magic.api.common.api;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.story_magic.api.catalog.application.BookNotFoundException;
import com.story_magic.api.catalog.application.InvalidSearchQueryException;
import com.story_magic.api.integrations.ExternalServiceException;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(BookNotFoundException.class)
	public ProblemDetail handleBookNotFound(BookNotFoundException exception) {
		return problem(HttpStatus.NOT_FOUND, "Livro não encontrado", exception.getMessage());
	}

	@ExceptionHandler(ExternalServiceException.class)
	public ProblemDetail handleExternalService(ExternalServiceException exception) {
		return problem(exception.getStatus(), "Falha em serviço externo", exception.getMessage());
	}

	@ExceptionHandler(InvalidSearchQueryException.class)
	public ProblemDetail handleInvalidSearch(InvalidSearchQueryException exception) {
		return problem(HttpStatus.BAD_REQUEST, "Busca inválida", exception.getMessage());
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		problem.setProperty("timestamp", Instant.now());
		return problem;
	}
}
