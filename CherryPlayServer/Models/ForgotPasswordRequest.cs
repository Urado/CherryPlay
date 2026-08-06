using System.ComponentModel.DataAnnotations;

namespace CherryPlayServer.Models;

public record ForgotPasswordRequest(
    [Required]
    [EmailAddress]
    string Email
);
